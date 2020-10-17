const tmi = require('tmi.js'),
	Settings = require('./settings.json'),
	irc = require('irc'),
	url = require('url'),
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
	ircClient = new irc.Client('irc.ppy.sh', Settings.osuIrcLogin,{
		port: 6667,
		password: Settings.osuIrcPass
	});

var usersMessages = new Map(),
	usersReqs = new Map(),
	lastReq = 0;

ircClient.connect();
client.connect();

function getTimeNow() { return parseInt(Math.round(new Date().getTime() / 1000)); }

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

async function getOppaiData(beatmap_id,mods,acc) {
	return new Promise(function(res) {
		exec(`curl "https://osu.ppy.sh/osu/${beatmap_id}" | "./oppai.exe" -${mods} ${acc}%`, function (err,stdout,stderr) {
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
var currentSkip = new Map(),
	usersMessages = new Map(),
	usersReqa = new Map(),
	lastReq = 0,
	currentSong = "";

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
	var message = message.toLowerCase();

	let linkParser = url.parse(message);
	if (rewards.has(user['custom-reward-id']) && (!linkParser.host)){
		if (!usersReqa.has(user.username) || usersReqa.get(user.username) < parseInt(getTimeNow() - 12)){
			ircClient.say(`${Settings.osuIrcLogin}`,`${user.username} > ${rewardOPT} ${message}`);
		}
	}
	if (linkParser.host == 'osu.ppy.sh' || linkParser.host == 'old.ppy.sh' || linkParser.host == 'osu.gatari.pw') {
		if (!usersReqa.has(user.username) || usersReqa.get(user.username) < parseInt(getTimeNow() - 12)) {
			if (lastReq < parseInt(getTimeNow() - 5)) {
				let pathArr = linkParser.path.split("/"),
					bId = (pathArr[1] == "b" || pathArr[1] == "beatmaps") ? parseInt(pathArr[2]) : parseInt(linkParser.hash.split("/")[1]);
				if (bId !== "null" && bId !== 0) {
					exec(`curl -X GET "https://osu.ppy.sh/api/get_beatmaps?k=${Settings.osuToken}&b=${bId}"`, async (err,stdout,stderr) => {
						if (stdout !== "null" && !err && isJson(stdout)) {
							let data = JSON.parse(stdout);
							if (data[0]) {
								lastReq = getTimeNow();
								usersReqa.set(user.username,getTimeNow());
								let arrIndexes = ['ez','ht','nf','hd','dt','nc','hr'];
								 	existMods = [],
									msgParse = message.replace(["https://"],"");
								for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMap.indexOf(item) + 1) existMap.push(item);
								let mI = data[0],
									newStarRate = 0,
									modsI = (existMods.length > 0) ? ` +${existMods.join('')}` : ``,
									oppaiData = [],
									ppAccString = ``;
								for await (let item of [100,99,98,95]) {
									let getOppai = await getOppaiData(bId,modsI,item);
									oppaiData.push(getOppai);
									ppAccString += `100%: ${getOppai.pp}PP, `;
								}
								let bpm = (existMods.indexOf('dt') + 1) || (existMods.indexOf('nc') + 1) ? parseInt(mI.bpm * 1.5) : parseInt(mI.bpm),
									bpmI = (existMods.indexOf('ht') + 1) ? parseInt(bpm * 0.75) : parseInt(bpm),
									starRate = (oppaiData[0]) ? parseFloat(oppaiData[0].stats.sr).toFixed(2) : parseFloat(mI.difficultyrating).toFixed(2),
									mapIrl = `[https://osu.ppy.sh/b/${mI.beatmap_id} ${mI.artist} - ${mI.title}]${modsI.toUpperCase()} (${bpmI} BPM, ${starRate} ⭐${ppAccString.substring(0, ppAccString.length - 2)})`;
								ircClient.say(`${Settings.osuIrcLogin}`,`${rewardOPT} ${user.username} > ${mapIrl}`);
								client.say(Settings.channel,`${user.username} ${mI.artist} - ${mI.title} реквест добавлен!`);
							}
						}
					});
				}
			}
		}
	}
	if (message === "!np" || message === "!нп" || message === "!карта" || message === "!map" || message === "!мап") {
		exec(`curl \
			-X GET "http://localhost:24050/json"`, (err,stdout,stderr) => {
			if (stdout !== "null" && !err && isJson(stdout)) {
				let data = JSON.parse(stdout),
					bm = data.menu.bm,
					mapd = bm.metadata,
					mapLink = (bm.id !== 0) ? `(https://osu.ppy.sh/beatmaps/${bm.id})` : `(карты нет на сайте)`;
				client.say(Settings.channel,entities.decode(`/me > ${user.username} Сейчас играет ${mapd.artist} - ${mapd.title} [${mapd.difficulty}] ${mapLink}`));
			}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Эта команда сейчас недоступна :(`));

		});
	}
	if (message === "!iq") {
		function randomInteger(min, max) {
			let rand = min - 0.5 + Math.random() * (max - min + 1);
			return Math.round(rand);
		}
		let randIq = randomInteger(1,250);
		if (user.username === "rowario") randIq = 99999999999999999;
		if (user.username === "robloxxa0_0") randIq = -1;
		client.say(Settings.channel, entities.decode(`/me > ${user.username} твой IQ ${randIq}`));
	}
	if (message === "!currentskin" | message === "!текущийскин" | message === "!skin" | message === "!скин") {
		exec(`curl \
			-X GET "http://localhost:24050/json"`, (err,stdout,stderr) => {
			if (stdout !== "null" && !err && isJson(stdout)) {
				let data = JSON.parse(stdout),
					skin = data.menu.skinFolder,
					allskins = new Map([
						["- # 『Rowario』 - (0.1)", "https://bit.ly/3nW03gv"],
						["- # 『RowarioDark』 - (0.1)", "https://bit.ly/3nQASvI"],
						["- # 『RowarioDark』 - (0.1) [DT]", "Временно недоступен"]
					]);
				if(allskins.has(skin)) {
					client.say(Settings.channel,entities.decode(`Текущий скин: ${skin} (${allskins.get(skin)})`))
				} else client.say(Settings.channel,entities.decode(`Текущий скин: ${skin} (Not Uploaded)`));
			}
			else client.say(Settings.channel, entities.decode(`Команда недосутпна :(`));
		});
	}
});
