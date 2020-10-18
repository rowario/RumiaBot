const tmi = require('tmi.js'),
	Settings = require('./config/settings.json'),
	Commandlist = require('./config/commands.json'),
	irc = require('irc'),
	url = require('url'),
	fs = require('fs'),
	Banchojs = require("bancho.js"),
	osu = require('node-osu'),
	request = require('request'),
	{spawn,exec} = require('child_process'),
	Entities = require('html-entities').XmlEntities,
	entities = new Entities(),
	client = new tmi.Client({
		options: { debug: true },
		connection: {
			reconnect: true,
			secure: true
		},
		identity: {
			username: Settings.botname,
			password: Settings.token
		},
		channels: [ Settings.channel ]
	}),
	osuApi = new osu.Api(Settings.osuToken, {
		notFoundAsError: true,
		completeScores: true,
		parseNumeric: false
	}),
	banchoIrc = new Banchojs.BanchoClient({ username: Settings.osuIrcLogin, password: Settings.osuIrcPass }),
	banchoUser = banchoIrc.getSelf();

var usersMessages = new Map(),
	usersReqs = new Map(),
	lastReq = 0;

banchoIrc.connect().then(() => {
	console.log(`Connected to bancho!`);
})
client.connect();

var usersMessages = new Map(),
	usersReqs = new Map(),
	lastReq = 0;

function getTimeNow() { return parseInt(Math.round(new Date().getTime() / 1000)); }

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

function osuLinkCheker(linkData) {
	let pathArr = linkData.path.split("/"),
		id;
	if (["b","beatmaps","beatmapsets"].indexOf(pathArr[1]) + 1) {
		if (pathArr[1] == 'beatmapsets' && linkData.hash !== null) {
			return {
				type: "b",
				id: parseInt(linkData.hash.split("/")[1])
			}
		}else if (["b","beatmaps"].indexOf(pathArr[1]) + 1){
			return {
				type: "b",
				id: parseInt(pathArr[2])
			}
		}
	}
	if (["s","beatmapsets"].indexOf(pathArr[1]) + 1) {
		return {
			type: "s",
			id: parseInt(pathArr[2])
		};
	}
	if (["u","users"].indexOf(pathArr[1]) + 1 && ["osu.ppy.sh","old.ppy.sh"].indexOf(linkData.host) + 1) {
		return {
			type: "p",
			id: parseInt(pathArr[2])
		};
	}
	return false;
}

function chekTimeout(username) {
	if (usersReqs.has(username) && usersReqs.get(username) > parseInt(getTimeNow() - 20)) return false;
	if (lastReq > parseInt(getTimeNow() - 5)) return false;
	return true;
}

// Для работы нужно создать папку beatmaps
// и добавь все содержимое в ней в gitignore "/beatmaps/*"
function getOsuFile(beatmap_id) {
	return new Promise( res => {
		let file_name = `./beatmaps/${beatmap_id}.osu`;
		if (!fs.existsSync(file_name)) {
			request({url: `https://osu.ppy.sh/osu/${beatmap_id}`}, (error, response, body) => {
				if (!error && body !== "null") {
					fs.writeFile(file_name, body, (err,data) => {
						if (err) res(false);
						res(file_name);
					})
				}
			});
		}else res(file_name);
	});
}

async function getOppaiData(beatmap_id,mods,acc) {
	return new Promise(async res => {
		let file_name = await getOsuFile(beatmap_id);
		exec(`"./oppai.exe" "${file_name}" ${mods} ${acc}%`, function (err,stdout,stderr) {
			if (!err && stdout !== "null") {
				let mapData = stdout.split("\n"),
					stats = mapData[12].split(" ");
				res({
					title: mapData[11].replace(/\r|/gi,""),
					stats:{
						ar: parseFloat(stats[1].replace(/ar|\r|/gi, "")),
						cs: parseFloat(stats[2].replace(/cs|\r|/gi, "")),
						od: parseFloat(stats[0].replace(/od|\r|/gi, "")),
						hp: parseFloat(stats[3].replace(/hp|\r|/gi, "")),
						sr: parseFloat(mapData[19].replace(/stars|\r|/gi, ""))
					},
					pp: parseFloat(mapData[29].replace(/pp|\r|/gi,""))
				});
			}else res(false);
		})
	});
}

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

client.on('message', async (channel, user, message, self) => {
	if(self) return;
	var uid = user['user-id'];
		rid = user['custom-reward-id']
	var message = message.toLowerCase();
	let linkParser = url.parse(message);
	let osureward = new Map(Settings.rewards.osu),
		twitchreward = new Map(Settings.rewards.twitch),
		rewardOPT = (osureward.has(rid)) ? `ОБЯЗАТЕЛЬНЫЙ РЕКВЕСТ: ${osureward.get(rid)} |` : "";
	if (osureward.has(rid) && (!linkParser.host) && chekTimeout(user.username)){
		banchoUser.sendMessage(`${user.username} > ${rewardOPT} ${message}`);
	}
	switch(message) {
		case "!нп":
		case "!мап":
		case "!карта":
		case "!nowplaying":
		case "!map":
		case "!np":
			request({url: `http://localhost:24050/json`}, (error, response, body) => {
				if (body !== "null" && !error && isJson(body)) {
					let data = JSON.parse(body),
						bm = data.menu.bm,
						mapd = bm.metadata,
						mapLink = (bm.id !== 0) ? `(https://osu.ppy.sh/beatmaps/${bm.id})` : `(карты нет на сайте)`;
					client.say(Settings.channel,entities.decode(`/me > ${user.username} Сейчас играет ${mapd.artist} - ${mapd.title} [${mapd.difficulty}] ${mapLink}`));
				}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Эта команда сейчас недоступна :(`));
			});
			break;
		case "!текущийскин":
		case "!скин":
		case "!currentskin":
		case "!skin":
			request({url: `http://localhost:24050/json`}, (error, response, body) => {
				if (body !== "null" && !error && isJson(body)) {
					let data = JSON.parse(body),
						skin = data.menu.skinFolder,
						allskins = new Map(Settings.skins);
					if(allskins.has(skin)) {
						client.say(Settings.channel,entities.decode(`/me > Текущий скин: ${skin} (${allskins.get(skin)})`))
					} else client.say(Settings.channel,entities.decode(`/me > Текущий скин: ${skin} (Not Uploaded)`));
				}
				else client.say(Settings.channel, entities.decode(`/me > Команда недосутпна :(`));
			});
			break;
		case "!iq":
			function randomInteger(min, max) {
				let rand = min - 0.5 + Math.random() * (max - min + 1);
				return Math.round(rand);
			}
			let randIq = randomInteger(1,250);
			if (user.username === "rowario") randIq = 99999999999999999;
			if (user.username === "robloxxa0_0") randIq = -1;
			client.say(Settings.channel, entities.decode(`/me > ${user.username} твой IQ ${randIq}`));
			break;
		default:
			if (linkParser.host == 'osu.ppy.sh' || linkParser.host == 'old.ppy.sh' || linkParser.host == 'osu.gatari.pw') {
				let linkInfo = osuLinkCheker(linkParser);
				console.log(linkInfo);
				if (linkInfo) {
					switch (linkInfo.type) {
						case "s":
						case "b":
							let getMapConfig = (linkInfo.type == "b") ? { b: linkInfo.id } : { s: linkInfo.id };
							osuApi.getBeatmaps(getMapConfig).then( async beatmaps => {
								if (beatmaps[0]) {
									lastReq = getTimeNow();
									usersReqs.set(user.username,getTimeNow());
									let arrIndexes = ['hd','dt','nc','hr','ez','nf','ht','v2'],
										existMods = [],
										msgParse = message.replace(["https://"],"");
									for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMods.indexOf(item) + 1) existMods.push(item);
									let mapInfo = beatmaps[0],
										newStarRate = 0,
										modsI = (existMods.length > 0) ? ` +${existMods.join('')}` : ``,
										oppaiData = [],
										ppAccString = ``;
									for await (let acc of [100,99,98,95]) {
										let getOppai = await getOppaiData(mapInfo.id,modsI,acc);
										oppaiData.push(getOppai);
										ppAccString += `${acc}%: ${getOppai.pp}PP, `;
									}
									let bpm = (existMods.indexOf('dt') + 1) || (existMods.indexOf('nc') + 1) ? parseInt(mapInfo.bpm * 1.5) : parseInt(mapInfo.bpm),
										bpmI = (existMods.indexOf('ht') + 1) ? parseInt(bpm * 0.75) : parseInt(bpm),
										starRate = (oppaiData[0]) ? parseFloat(oppaiData[0].stats.sr).toFixed(2) : parseFloat(mapInfo.difficultyrating).toFixed(2),
										mapIrc = `[https://osu.ppy.sh/b/${mapInfo.id} ${mapInfo.artist} - ${mapInfo.title}] ${modsI.toUpperCase()} (${bpmI} BPM, ${starRate} ⭐${ppAccString.substring(0, ppAccString.length - 2)})`;
									banchoUser.sendMessage(`${rewardOPT} ${user.username} > ${mapIrc}`);
									client.say(Settings.channel,`/me > ${rewardOPT} ${user.username} ${mapInfo.artist} - ${mapInfo.title} реквест добавлен!`);
								}
							});
							break;
						case "u":
						case "users":
							break;
						default: break;
					}
				}
			}
			//TODO: Добавить возможность написания кастомный команд
			//TODO: Возможно добавить создание/удаление/редактирование команд
			break;
	}
});
