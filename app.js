const tmi = require('tmi.js'),
	Level = require('./get_level.js'),
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

ircClient.connect();
client.connect();

function getTimeNow() { return parseInt(Math.round(new Date().getTime() / 1000)); }

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
	let rewards = new Map([
		["626ba9d4-3478-442d-9c1d-56af03af9f77", "Играть с FL"],
		["30b2e45b-6626-454c-ad13-11517c573dd0", "Играть с выкл. монитором"]
	]);
	let rewardOPT = (rewards.has(user['custom-reward-id'])) ? `ОБЯЗАТЕЛЬНЫЙ РЕКВЕСТ: ${rewards.get(user['custom-reward-id'])} |` : "";
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
					exec(`curl \
						-X GET "https://osu.ppy.sh/api/get_beatmaps?k=${Settings.osuToken}&b=${bId}"`, async (err,stdout,stderr) => {
						if (stdout !== "null" && !err && isJson(stdout)) {
							let data = JSON.parse(stdout);
							if (data[0]) {
								lastReq = getTimeNow();
								usersReqa.set(user.username,getTimeNow());
								let arrIndexes = ['ez','ht','nf','hd','dt','hr'];
								let existMap = [],
									msgParse = message.replace(["https://"],"");
								for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMap.indexOf(item) + 1) existMap.push(item);
								let mI = data[0],
									newStarRate = 0,
									modsI = (existMap.length > 0) ? ` +${existMap.join('')}` : ``;
								let oppaInfo100 = await getOppaiData(bId,modsI,100);
								let oppaInfo99 = await getOppaiData(bId,modsI,99);
								let oppaInfo98 = await getOppaiData(bId,modsI,98);
								let oppaInfo95 = await getOppaiData(bId,modsI,95);
								let ppAccString = ``;
								if (oppaInfo100) ppAccString += `100%: ${oppaInfo100.pp}PP, `;
								if (oppaInfo99) ppAccString += `99%: ${oppaInfo99.pp}PP, `;
								if (oppaInfo98) ppAccString += `98%: ${oppaInfo98.pp}PP, `;
								if (oppaInfo95) ppAccString += `95%: ${oppaInfo95.pp}PP, `;
								ppAccString = ppAccString.substring(0, ppAccString.length - 2);
								let bpm = (existMap.indexOf('dt') + 1) ? parseInt(mI.bpm * 1.5) : parseInt(mI.bpm),
									bpmI = (existMap.indexOf('ht') + 1) ? parseInt(bpm * 0.75) : parseInt(bpm),
									ppData = (ppAccString) ? `, ${ppAccString}` : ``,
									starRate = (oppaInfo100) ? parseFloat(oppaInfo100.stats.sr).toFixed(2) : parseFloat(mI.difficultyrating).toFixed(2),
									mapSL = `[https://osu.ppy.sh/b/${mI.beatmap_id} ${mI.artist} - ${mI.title} [${mI.version}]]${modsI.toUpperCase()}`,
									mapTL = `${mI.artist} - ${mI.title} [${mI.version}]`,
									mapSD = `(${bpmI} BPM, ${starRate} ⭐${ppData})`;
								ircClient.say(`${Settings.osuIrcLogin}`,`${user.username} > ${rewardOPT} ${mapSL} ${mapSD}`);
								client.say(Settings.channel,`${user.username} ${mapTL} request added!`);
							}
						}
					});
				}
			}
		}
	}
	if (message === "!currentskin" | message === "!текущийскин" | message === "!skin" | message === "!скин") {
		exec(`curl \
			-X GET "http://localhost:24050/json"`, (err,stdout,stderr) => {
			if (stdout !== "null" && !err && isJson(stdout)) {
				let data = JSON.parse(stdout),
					skin = data.menu.skinFolder,
					allskins = new Map([
						["# 108Joker(Red)", "https://bit.ly/3nW03gv"],
						["# Aristia(Blue Cursor)", "https://bit.ly/3nQASvI"],
						["# Aristia(Cursor notrail)", "https://bit.ly/31cRgwW"],
						["# Aristia(CursorTrail)", "https://bit.ly/355AfGc"],
						["# azer8dawn", "https://bit.ly/3lM3ep4"],
						["# Default Skin edit", "https://bit.ly/353odNB"],
						["# Emilia Skin", "https://bit.ly/353mRCv"],
						["# Enslada", "https://bit.ly/31fCA09"],
						["# NaruV3.0", "https://bit.ly/3lQgetW"],
						["# pixel atmosphere", "https://bit.ly/2IBY8xv"],
						["# Hikonya", "https://bit.ly/3lSWuG5"],
						["# Papich Skin", "https://bit.ly/37issrn"]
					]);
				if(allskins.has(skin)) {
						client.say(Settings.channel,entities.decode(`Current Skin: ${skin} (${allskins.get(skin)})`))
					} else client.say(Settings.channel,entities.decode(`Current Skin: ${skin} (Not Uploaded)`));
			}
			else client.say(Settings.channel, entities.decode(`Command not available :(`));
		});
	}
	if (message === "!np" || message === "!нп" || message === "!карта" || message === "!map" || message === "!мап") {
		exec(`curl \
			-X GET "http://localhost:24050/json"`, (err,stdout,stderr) => {
			if (stdout !== "null" && !err && isJson(stdout)) {
				let data = JSON.parse(stdout),
					bm = data.menu.bm,
					mapd = bm.metadata,
					mapLink = (bm.id !== 0) ? `https://osu.ppy.sh/beatmaps/${bm.id}` : `(Not Submitted)`;
				client.say(Settings.channel,entities.decode(`Now playing: ${mapd.artist} - ${mapd.title} [${mapd.difficulty}] ${mapLink}`));
			}else client.say(Settings.channel, entities.decode(`Command not available :(`));
		});
	}
	if (message === "!iq") {
		function randomInteger(min, max) {
			let rand = min - 0.5 + Math.random() * (max - min + 1);
			return Math.round(rand);
		}
		let randIq = randomInteger(1,250);
		if (user.username === "rowario") randIq = 99999999999999999;
		client.say(Settings.channel, entities.decode(`${user.username} твой IQ ${randIq}`));
	}
});
