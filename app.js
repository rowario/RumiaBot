const tmi = require('tmi.js'),
	Settings = require('./config/settings.json'),
	Commandlist = require('./config/commands.json'),
	url = require('url'),
	fs = require('fs'),
	request = require('request'),
	OsuRequest = require('./osu-request.js'),
	Entities = require('html-entities').XmlEntities,
	entities = new Entities(),
	Database = require("./database.js"),
	db = new Database("database.sqlite"),
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
		case "!com":
			//TODO: Редактирование комманд из базы данных
			if(user.badges.broadcaster || user.badges.moderator){
				switch(msgArr[1]){
					case "add":
						let aliases = msgArr[2],
						answer = msgArr.splice(3, msgArr.length).join(" ");
						if(await db.createCommand(aliases, answer)){
							client.say(Settings.channel, entities.decode(`/me > ${user.username}, команда ${aliases.split("/")[0]} успешно добавлена`))
						} else{
							client.say(Settings.channel, entities.decode(`/me > ${user.username}, такая команда уже существует!`))
						}
						break;
					case "edit":
						break;
					case "delete":
						if(await db.deleteCommand(msgArr[2])){
							client.say(Settings.channel, `/me > ${user.username}, команда ${msgArr[2]} успешно удалена!`);
						} else{
							client.say(Settings.channel, `/me > ${user.username}, такой команды не существует`);
						}
						break;
				}
			}
		default:
			// new
			if (linkParser.host === 'osu.ppy.sh' || linkParser.host === 'old.ppy.sh' || linkParser.host === 'osu.gatari.pw') {
				let linkInfo = osuLinkChecker(linkParser);
				if (linkInfo && chekTimeout(user.username)) {
					switch (linkInfo.type) {
						case "s":
						case "b":
							let osuReq = await OsuRequest.sendRequest(linkInfo,user.username,osuLink,rewardOPT);
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

			if(await db.getCommand(msgArr[0])){
				let answer = await db.getCommand(msgArr[0]);
				client.say(Settings.channel, `/me > ${answer.answer}`);
			}
			break;
	}
});
