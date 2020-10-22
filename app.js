const tmi = require('tmi.js'),
	Settings = require('./config/settings.json'),
	Commandlist = require('./config/commands.json'),
	url = require('url'),
	fs = require('fs'),
	request = require('request'),
	OsuRequest = require('./osu-request.js'),
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
	});

var usersReqs = new Map(),
	lastReq = 0;

client.connect();

function getTimeNow() { return parseInt(Math.round(new Date().getTime() / 1000)); }

function updateConfig(file,rewrite) {
	return new Promise( resolve => {
		fs.readFile(file,function (err,data) {
			if (err) throw err;
			let jsonData = JSON.parse(data);
			for (let [key, value] of Object.entries(jsonData)) {
				rewrite[key] = value;
			}
			resolve();
		})
	});
}

function osuLinkChecker(linkData) {
	let pathArr = linkData.path.split("/");
	if (["b","beatmaps","beatmapsets"].indexOf(pathArr[1]) + 1) {
		if (pathArr[1] === 'beatmapsets' && linkData.hash !== null) {
			return {type: "b", id: parseInt(linkData.hash.split("/")[1])}
		}else if (["b","beatmaps"].indexOf(pathArr[1]) + 1){
			return {type: "b", id: parseInt(pathArr[2])}
		}
	}
	if (["s","beatmapsets"].indexOf(pathArr[1]) + 1) {
		return {type: "s", id: parseInt(pathArr[2])};
	}
	if (["u","users"].indexOf(pathArr[1]) + 1 && ["osu.ppy.sh","old.ppy.sh"].indexOf(linkData.host) + 1) {
		return {type: "p", id: parseInt(pathArr[2])};
	}
	return false;
}

function chekTimeout(username) {
	if (usersReqs.has(username) && usersReqs.get(username) > parseInt(getTimeNow() - 20)) return false;
	return lastReq <= parseInt(getTimeNow() - 5);

}

function randomInteger(min, max) {
	let rand = min - 0.5 + Math.random() * (max - min + 1);
	return Math.round(rand);
}

function getLink(message){
	let arrMsg = message;
	for(let http in arrMsg){
		if(url.parse(arrMsg[http]).protocol !== null){
			return arrMsg.splice(http, message.length).join(" ");
		}
	}
	return message.join();
}

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

client.on('message', async (channel, user, msg, self) => {
	if(self) return;
	await updateConfig('./config/settings.json',Settings);
	await updateConfig('./config/commands.json',Commandlist);
	let rid = user['custom-reward-id'],
		message = msg.toLowerCase(),
		msgArr = message.split(' '),
		osuLink = getLink(msgArr),
		linkParser = url.parse(osuLink),
		osureward = new Map(Settings.rewards.osu),
		// twitchreward = new Map(Settings.rewards.twitch),
		rewardOPT = (osureward.has(rid)) ? `ОБЯЗАТЕЛЬНЫЙ РЕКВЕСТ: ${osureward.get(rid)} |` : "";

	if (osureward.has(rid)) OsuRequest.setFormat(`ОБЯЗАТЕЛЬНЫЙ РЕКВЕСТ: ${osureward.get(rid)} | {username} > {dllink} {bclink} {mods} {mapstat}`);

	if (osureward.has(rid) && (!linkParser.host) && chekTimeout(user.username)) await OsuRequest.sendMessage(`${user.username} > ${rewardOPT} ${message}`);

	switch(msgArr[0]) {
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
			let selfCheck = (!(message.match(/@/gi) && msgArr[1].replace(/@/gi, "") !== `${user.username}`)),
				checkUser = (selfCheck) ? user.username : msgArr[1].replace(/@/,"");
			let randIq = randomInteger(1,250);
			if (checkUser === "rowario") randIq = 99999999999999999;
			if (checkUser === "robloxxa0_0") randIq = -1;
			client.say(
				Settings.channel,
				entities.decode((selfCheck) ? `/me > ${user.username} твой IQ ${randIq}` : `/me > ${user.username} ты проверил iq у ${checkUser}, у него ${randIq}`)
			);
			break;
		default:
			// new
			if (linkParser.host === 'osu.ppy.sh' || linkParser.host === 'old.ppy.sh' || linkParser.host === 'osu.gatari.pw') {
				let linkInfo = osuLinkChecker(linkParser);
				if (linkInfo && chekTimeout(user.username)) {
					switch (linkInfo.type) {
						case "s":
						case "b":
							let osuReq = await OsuRequest.sendRequest(linkInfo,user.username,osuLink);
							if (osuReq) {
								lastReq = getTimeNow();
								usersReqs.set(user.username,getTimeNow());
								client.say(Settings.channel,`/me > ${rewardOPT} ${user.username} ${osuReq.artist} - ${osuReq.title} ${osuReq.mods} реквест добавлен!`);
							}
							break;
						case "p":
							// Место под проверку профилей
						default: break;
					}
				}
			}
			//TODO: Добавление|Удаление|Редактирование комманд из базы данных

			// for (let command of Commandlist) {
			// 	if (command.aliases.indexOf(message) + 1) {
			// 		if (command.settings.modonly && !(user.badges.broadcaster|| user.badges.moderator)) break;
			// 		let mention = (command.settings.mention) ? `${user.username}` : ``;
			// 		client.say(Settings.channel, `/me > ${mention} ${command.answer}`);
			// 		break;
			// 	}
			// }
			break;
	}
});
