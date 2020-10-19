const tmi = require('tmi.js'),
	Level = require('./get_level.js'),
	Settings = require('./config/settings.json'),
	Commandlist = require('./config/commands.json'),
	Banchojs = require("bancho.js"),
	mongoose = require('mongoose'),
	url = require('url'),
	fs = require('fs'),
	osu = require('node-osu'),
	{spawn,exec} = require('child_process'),
	request = require('request'),
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

	var currentSkip = new Map(),
		usersMessages = new Map(),
		usersReqs = new Map(),
		lastReq = 0,
		currentSong = "";

mongoose.connect(Settings.database,{
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useFindAndModify: false
});
banchoIrc.connect().then(() => {
	console.log("Bancho connected!");
}).catch(console.error);
client.connect();

const User = mongoose.model('users', { id: Number, username: String, display_name: String, reg_time: Number, expirience: Number,
	count_messages: Number, level: Number, rank: Number, stream_messages: Number });
const Active = mongoose.model('active', { id: Number, meter: Number, username: String });

// USER
async function getUser(user_id) { var u = await User.findOne({ id: user_id }); return u }
async function updateExpirience(user_id, exp) { await User.findOneAndUpdate({ id: user_id }, { $inc: { expirience: exp } } ).then((e) => { }) }
async function decreaseExpirience(user_id) { await User.findOneAndUpdate({ id: user_id }, { $inc: { expirience: -10 } } ).then((e) => { }) }
async function updateLevel(user_id,lvl) { await User.findOneAndUpdate({ id: user_id }, { level: lvl } ).then((e) => { }) }
async function increaseMsgCount(user_id) { await User.findOneAndUpdate({ id: user_id }, { $inc: { count_messages: 1, stream_messages: 1 } } ).then((e) => { }) }
async function getLeaderboard() { let lead = await User.find({}).sort({ expirience: -1 }); return lead; }
async function updateRank(uid,rank) { await User.findOneAndUpdate({ id: uid },{ rank: rank }).then((e) => { }) }
async function updateUsername(uid,user) { await User.findOneAndUpdate({ id: uid },{ username: user.username, display_name: user['display-name'] }).then((e) => { }) }
async function clearAchievements(user_id) { await User.findOneAndUpdate({ id: user_id }, { stream_messages: 0 } ).then((e) => { }) }
async function clearAllUsersMessages() { await User.updateMany({ }, { stream_messages: 0 } ).then((e) => { }) }
// USER

// ACTIVE
async function getActive(uid) { var ac = await Active.findOne({ id: uid }); return ac }
async function upActive(uid) { var ac = await Active.updateOne({ id: uid },{ meter: 10 }); return ac }
async function decActive(uid) { var ac = await Active.updateOne({ id: uid }, { $inc: { meter: -1 } }); }
async function deleteActive(uid) { var ac = await Active.deleteOne({ id: uid }); }
// ACTIVE

function updateConfig(file,rewrite) {
	fs.readFile(file,function (err,data) {
		if (err) throw err;
		let jsonData = JSON.parse(data);
		for (let [key, value] of Object.entries(jsonData)) {
			rewrite[key] = value;
		}
	})
}

function getTimeNow() { return parseInt(Math.round(new Date().getTime() / 1000)); }

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

async function updateActivity(user) {
	let uid = user.id;
	var active = await getActive(uid);
	if (!active) {
		active = new Active({ id: uid, meter: 0, username: user.username })
		await active.save();
	}
	await upActive(uid);
}

async function updateAllActiveUsers() {
	function getRand(min, max) {
		return parseInt(Math.random() * (max - min) + min);
	}
	var activeUsers = await Active.find({});
	activeUsers.forEach( async (item,i) => {
		if (item.meter >= 1) {
			if (item.meter >= 9) {
				let uData = await getUser(item.id);
				if (uData.level <= 8) {
					updateExpirience(uData.id,10);
				}else {
					updateExpirience(uData.id,uData.level * 0.9);
				}
			}else {
				let randVals = [1,2];
				if (item.meter == 7) randVals = [6,7];
				if (item.meter == 6) randVals = [5,6];
				if (item.meter == 5) randVals = [4,5];
				if (item.meter == 4) randVals = [3,4];
				if (item.meter == 3) randVals = [2,3];
				updateExpirience(item.id,getRand(randVals[0],randVals[1]));
			}
			decActive(item.id);
			console.log(`Пользователь ${item.username} имеет уровень активности: ${item.meter}`);
		}else deleteActive(item.id);
	});
	checkLevels(activeUsers);
}

async function checkLevels(activeUsers) {
	activeUsers.forEach(async (item, i) => {
		let checkUser = await getUser(item.id);
		let newLevel = Level.getLevel(checkUser.expirience);
		if (newLevel > checkUser.level) {
			updateLevel(item.id,newLevel);
			client.say(Settings.channel, `/me > ${checkUser.username} получает уровень ${newLevel} PogChamp`);
		}
	});
}

async function updateRanks() {
	let users = await getLeaderboard();
	let rank = 1;
	users.forEach(async (item, i) => {
		updateRank(item.id,rank);
		rank++;
	});
}

async function checkAchievements (u) {
	if (u.stream_messages >= 250) {
		updateExpirience(u.id,500);
		clearAchievements(u.id);
		client.say(Settings.channel, `/me > ${user.username} отправил 250 сообщений за стрим, за это ему начисленно 500 опыта PogChamp`);
	}
}

function osuLinkCheker(linkData) {
	let pathArr = linkData.path.split("/"),
		id;
	if (["b","beatmaps","beatmapsets"].indexOf(pathArr[1]) + 1) {
		if (pathArr[1] == 'beatmapsets' && linkData.hash !== null) {
			return { type: "b", id: parseInt(linkData.hash.split("/")[1]) }
		}else if (["b","beatmaps"].indexOf(pathArr[1]) + 1){
			return { type: "b", id: parseInt(pathArr[2]) }
		}
	}
	if (["s","beatmapsets"].indexOf(pathArr[1]) + 1) {
		return { type: "s", id: parseInt(pathArr[2]) }
	}
	if (["u","users"].indexOf(pathArr[1]) + 1 && ["osu.ppy.sh","old.ppy.sh"].indexOf(linkData.host) + 1) {
		return { type: "p", id: parseInt(pathArr[2]) }
	}
	return false;
}

function chekTimeout(username) {
	if (usersReqs.has(username) && usersReqs.get(username) > parseInt(getTimeNow() - 20)) return false;
	if (lastReq > parseInt(getTimeNow() - 5)) return false;
	return true;
}

function randomInteger(min, max) {
	let rand = min - 0.5 + Math.random() * (max - min + 1);
	return Math.round(rand);
}

function getMods(message) {
	let arrIndexes = ['hd','dt','nc','hr','ez','nf','ht','v2'],
		existMods = [],
		msgParse = message.replace(["https://"],"");
	for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMods.indexOf(item) + 1) existMods.push(item);
	return (existMods.length > 0) ? ` +${existMods.join('')}` : ``;
}

function getBpm(baseBpm,message) {
	let arrIndexes = ['dt','nc','ht'],
		existMods = [],
		msgParse = message.replace(["https://"],"");
	for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMods.indexOf(item) + 1) existMods.push(item);
	let dtCheck = (existMods.indexOf('dt') + 1) || (existMods.indexOf('nc') + 1) ? parseInt(baseBpm * 1.5) : parseInt(baseBpm),
		htCheck = (existMods.indexOf('ht') + 1) ? parseInt(dtCheck * 0.75) : parseInt(dtCheck);
	return htCheck;
}

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

client.on('message', async (channel, user, msg, self) => {
	if(self) return;
	updateConfig('./config/settings.json',Settings);
	updateConfig('./config/commands.json',Commandlist);
	var uid = user['user-id'];
	var u = await getUser(uid);
	let message = msg.toLowerCase(),
		messageArr = message.split(" ");

	if (!u) {
		u = new User({ id: uid, username: user.username, display_name: user['display-name'], reg_time: (new Date()).getTime(),
		expirience: 0, count_messages: 0, level: 0, rank: 0,stream_messages: 0 })
		await u.save()
	}

	if (user.username !== user.username) {
		updateUsername(uid,user);
	}

	increaseMsgCount(uid);

	checkAchievements(u);

	if (usersMessages.has(user.username) && usersMessages.get(user.username) >= parseInt(getTimeNow() - 2)) decreaseExpirience(u.id);

	usersMessages.set(user.username,getTimeNow());

	if (user.username != 'moobot') updateActivity(u);

	let linkParser = url.parse(message);

	switch (messageArr[0]) {
		case "!rank":
		case "!ранк":
			client.say(Settings.channel, `/me > ${user.username} твой ранк #${u.rank}`);
			break;
		case "!count":
		case "!каунт":
			client.say(Settings.channel, `/me > ${user.username} отправил ${u.count_messages} сообщений BloodTrail`);
			break;
		case "!achievement":
		case "!ачивка":
			let countToAchiv = parseInt(500 - u.stream_messages);
			// client.say(Settings.channel, `/me > ${user.username} ты можешь отправить еще ${countToAchiv} сообщений за стрим, и получить 1000 опыта PogChamp`);
			client.say(Settings.channel, `/me > ${user.username} ты можешь отправить 250 сообщений за стрим, и получить 500 опыта PogChamp`);
			break;
		case "!song":
		case "!music":
		case "!трек":
		case "!сонг":
		case "!музыка":
			request({url: `https://streamdj.ru/api/get_track/${Settings.djid}`}, (error, response, body) => {
				if (body !== "null" && isJson(body) && !error) {
					let data = JSON.parse(stdout);
					client.say(Settings.channel, entities.decode(`/me > ${user.username} Сейчас играет "${data.title}" (youtube.com/watch?v=${data.yid})`));
				}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Сейчас ничего не играет!`));
			});
			break;
		case "!skip":
		case "!скип":
			let maxSkipCount = 5;
			request({url: `https://streamdj.ru/api/get_track/${Settings.djid}`}, (error, response, body) => {
				if (body !== "null" && isJson(body) && !error) {
					let currentSongData = JSON.parse(body);
					if (currentSong !== currentSongData.title) {
						currentSkip.clear();
						currentSong = currentSongData.title;
					}
					if (!currentSkip.has(user['user-id'])) {
						currentSkip.set(user['user-id'],'skip');
						if (currentSkip.size >= maxSkipCount) {
							request({url: `https://streamdj.ru/api/request_skip/${Settings.djid}/${Settings.djtoken}`}, (error, response, body) => {
								if (!error && body !== "null" && isJson(body)) {
									let data = JSON.parse(body);
									currentSkip.clear();
									client.say(Settings.channel, entities.decode(`/me > "${currentSongData.title}" успешно пропущен PogChamp`));
								}
							});
						}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Твой голос учтен, голосов для пропуска ${currentSkip.size}/${maxSkipCount}`));
					}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Ты уже проголосовал за пропуск этого трека!`));
				}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Сейчас ничего не играет!`));
			});
			break;
		case "!banskip":
		case "!банскип":
			if (user.badges.moderator || user.badges.broadcaster) {
				request({url: `https://streamdj.ru/api/get_track/${Settings.djid}`}, (error, response, body) => {
					if (!error && body !== "null" && isJson(body)) {
						let currentSongData = JSON.parse(body);
						request({url: `https://streamdj.ru/api/request_skip/${Settings.djid}/${Settings.djtoken}`}, (error, response, body) => {
							if (!error && body !== "null" && isJson(body)) {
								let data = JSON.parse(body);
								currentSkip.clear();
								client.say(Settings.channel, entities.decode(`/me > ${user.username} успешно пропустил трек, по причине банворд D:`));
							}
						});
					}else client.say(Settings.channel, entities.decode(`/me > ${user.username} Сейчас ничего не играет!`));
				});
			}else client.say(Settings.channel, entities.decode(`/me > ${user.username} ты хто?`));
			break;
		case "!np":
		case "!нп":
		case "!map":
		case "!мап":
		case "!карта":
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
		case "!iq":
			let selfCheck = (message.match(/@/gi) && messageArr[1].replace(/@/gi,"") !== `${user.username}`) ? false : true,
				checkUser = (selfCheck) ? user.username : messageArr[1];
			let randIq = randomInteger(1,250);
			if (checkUser === "rowario") randIq = 99999999999999999;
			client.say(
				Settings.channel,
				entities.decode((selfCheck) ? `/me > ${user.username} твой IQ ${randIq}` : `/me > ${user.username} ты проверил iq у ${checkUser}, у него ${randIq}`)
			);
			break;
		case "!leaderboard":
		case "!лидерборд":
		case "!top":
		case "!топ":
			let topUsers = await getLeaderboard(),
				msg = `/me > `;
			await topUsers.forEach((item, i) => {
				if (i < 15) {
					let adder = (i == 0) ? "" : "|";
					msg += `${adder} #${i+1} ${item.display_name} (${item.level} lvl) `;
				}
			});
			client.say(Settings.channel, entities.decode(msg));
			break;
		case "!currentskin":
		case "!текущийскин":
		case "!skin":
		case "!скин":
			request({url:`http://localhost:24050/json`}, (error, response, body) => {
				if (body !== "null" && !error && isJson(body)) {
					let data = JSON.parse(body),
						skin = data.menu.skinFolder,
						allskins = new Map(Settings.skins);
					if(allskins.has(skin)) {
						client.say(Settings.channel,entities.decode(`Текущий скин: ${skin} (${allskins.get(skin)})`))
					} else client.say(Settings.channel,entities.decode(`Текущий скин: ${skin} (Not Uploaded)`));
				}
				else client.say(Settings.channel, entities.decode(`Команда недосутпна :(`));
			});
			break;
		case "!lvl":
		case "!лвл":
		case "!level":
		case "!уровень":
			client.say(Settings.channel, `/me > ${user.username} твой уровень ${Level.getLevel(u.expirience)}, у тебя ${parseInt(u.expirience)} опыта!`);
			break;
		default:
			if (linkParser.host == 'osu.ppy.sh' || linkParser.host == 'old.ppy.sh' || linkParser.host == 'osu.gatari.pw') {
				let linkInfo = osuLinkCheker(linkParser);
				if (linkInfo && chekTimeout(user.username)) {
					switch (linkInfo.type) {
						case "s":
						case "b":
							let getMapConfig = (linkInfo.type == "b") ? { b: linkInfo.id } : { s: linkInfo.id };
							osuApi.getBeatmaps(getMapConfig).then( async beatmaps => {
								if (beatmaps[0]) {
									lastReq = getTimeNow();
									usersReqs.set(user.username,getTimeNow());
									let mapInfo = beatmaps[0],
										oppaiData = [],
										ppAccString = [];
									for await (let acc of [95,98,99,100]) {
										let getOppai = await getOppaiData(mapInfo.id,getMods(message),acc);
										oppaiData.push(getOppai);
										ppAccString.push(`${acc}%: ${getOppai.pp}PP`);
									}
									let bpm = getBpm(mapInfo.bpm,message),
										starRate = (oppaiData[0]) ? parseFloat(oppaiData[0].stats.sr).toFixed(2) : parseFloat(mapInfo.difficultyrating).toFixed(2),
										mapIrc = `[https://osu.ppy.sh/b/${mapInfo.id} ${mapInfo.artist} - ${mapInfo.title}] [https://bloodcat.com/osu/s/${mapInfo.beatmapSetId} BC] ${getMods(message).toUpperCase()} (${bpm} BPM, ${starRate} ⭐${ppAccString.join(', ')})`;
									banchoUser.sendMessage(`${user.username} > ${mapIrc}`);
									client.say(Settings.channel,`/me > ${user.username} ${mapInfo.artist} - ${mapInfo.title} реквест добавлен!`);
								}
							});
							break;
						case "s":
							// Место под проверку профилей
						default: break;
					}
				}
			}
			for (command of Commandlist) {
				if (command.aliases.indexOf(message) + 1) {
					if (command.settings.modonly && !(user.badges.broadcaster|| user.badges.moderator)) break;
					let mention = (command.settings.mention) ? `${user.username}` : ``;
					client.say(Settings.channel, `/me > ${mention} ${command.answer}`);
					break;
				}
			}
			// TODO: Добавление удаление комманд
		break;
	}
});

setInterval(function () {
	updateAllActiveUsers();
},59000);
setInterval(function () {
	updateRanks();
},30000);

clearAllUsersMessages();
