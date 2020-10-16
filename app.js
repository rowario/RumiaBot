const tmi = require('tmi.js'),
	Level = require('./get_level.js'),
	Settings = require('./settings.json'),
	mongoose = require('mongoose'),
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
			username: 'rowariobot',
			password: Settings.token
		},
		channels: [ Settings.channel ]
	}),
	ircClient = new irc.Client('irc.ppy.sh', Settings.osuIrcLogin,{
		port: 6667,
		password: Settings.osuIrcPass
	});

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
ircClient.connect();
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
		client.say(Settings.channel, `/me > ${u.username} отправил 250 сообщений за стрим, за это ему начисленно 500 опыта PogChamp`);
	}
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

client.on('message', async (channel, user, message, self) => {
	if(self) return;
	var uid = user['user-id'];
	var u = await getUser(uid);
	var message = message.toLowerCase();
	if (!u) {
		u = new User({ id: uid, username: user.username, display_name: user['display-name'], reg_time: (new Date()).getTime(),
		expirience: 0, count_messages: 0, level: 0, rank: 0,stream_messages: 0 })
		await u.save()
	}

	if (u.username !== user.username) {
		updateUsername(uid,user);
	}

	increaseMsgCount(uid);

	checkAchievements(u);

	if (usersMessages.has(u.username) && usersMessages.get(u.username) >= parseInt(getTimeNow() - 2)) decreaseExpirience(u.id);

	usersMessages.set(u.username,getTimeNow());

	let linkParser = url.parse(message);

	if (linkParser.host == 'osu.ppy.sh' || linkParser.host == 'old.ppy.sh' || linkParser.host == 'osu.gatari.pw') {
		if (!usersReqs.has(user.username) || usersReqs.get(user.username) < parseInt(getTimeNow() - 20)) {
			if (lastReq < parseInt(getTimeNow() - 5)) {
				let pathArr = linkParser.path.split("/"),
					bId = (pathArr[1] == "b" || pathArr[1] == "beatmaps") ? parseInt(pathArr[2]) : parseInt(linkParser.hash.split("/")[1]);
				if (bId !== "null" && bId !== 0) {
					exec(`curl -X GET "https://osu.ppy.sh/api/get_beatmaps?k=${Settings.osuToken}&b=${bId}"`, async (err,stdout,stderr) => {
						if (stdout !== "null" && !err && isJson(stdout)) {
							let data = JSON.parse(stdout);
							if (data[0]) {
								lastReq = getTimeNow();
								usersReqs.set(user.username,getTimeNow());
								let arrIndexes = ['hd','dt','nc','hr','ez','nf','ht','v2'],
									existMods = [],
									msgParse = message.replace(["https://"],"");
								for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMods.indexOf(item) + 1) existMods.push(item);
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
								let bpm = (existMods.indexOf('dt') + 1 || (existMods.indexOf('nc') + 1) ? parseInt(mI.bpm * 1.5) : parseInt(mI.bpm),
									bpmI = (existMods.indexOf('ht') + 1) ? parseInt(bpm * 0.75) : parseInt(bpm),
									starRate = (oppaiData[0]) ? parseFloat(oppaiData[0].stats.sr).toFixed(2) : parseFloat(mI.difficultyrating).toFixed(2),
									mapIrl = `[https://osu.ppy.sh/b/${mI.beatmap_id} ${mI.artist} - ${mI.title}]${modsI.toUpperCase()} (${bpmI} BPM, ${starRate} ⭐${ppAccString.substring(0, ppAccString.length - 2)})`;
								ircClient.say(`${Settings.osuIrcLogin}`,`${user.username} > ${mapIrl}`);
								client.say(Settings.channel,`/me > ${user.username} ${mI.artist} - ${mI.title} реквест добавлен!`);
							}
						}
					});
				}
			}
		}
	}

	if (user.username != 'moobot') {
		updateActivity(u);
		if (message === "!lvl") {
			client.say(Settings.channel, `/me > ${user.username} твой уровень ${Level.getLevel(u.expirience)}, у тебя ${parseInt(u.expirience)} опыта!`);
		}
	}
	if (message === "!rank" || message === "!ранк") {
		client.say(Settings.channel, `/me > ${u.username} твой ранк #${u.rank}`);
	}
	if (message === "!count" || message === "!каунт") {
		client.say(Settings.channel, `/me > ${u.username} отправил ${u.count_messages} сообщений BloodTrail`);
	}
	if (message === "!achievement" || message === "!ачивка") {
		let countToAchiv = parseInt(500 - u.stream_messages);
		// client.say(Settings.channel, `/me > ${u.username} ты можешь отправить еще ${countToAchiv} сообщений за стрим, и получить 1000 опыта PogChamp`);
		client.say(Settings.channel, `/me > ${u.username} ты можешь отправить 250 сообщений за стрим, и получить 500 опыта PogChamp`);
	}
	if (message === "!song" || message === "!трек" || message === "!сонг" || message === "!музыка" || message === "!music") {
		exec(`curl \
			-X GET "https://streamdj.ru/api/get_track/${Settings.djid}"`, (err,stdout,stderr) => {
			if (stdout !== "null" && isJson(stdout)) {
				let data = JSON.parse(stdout);
				client.say(Settings.channel, entities.decode(`/me > ${u.username} Сейчас играет "${data.title}" (youtube.com/watch?v=${data.yid})`));
			}else client.say(Settings.channel, entities.decode(`/me > ${u.username} Сейчас ничего не играет!`));
		});
	}
	if (message === "!skip" || message === "!скип") {
		let maxSkipCount = 5;
		exec(`curl \
			-X GET "https://streamdj.ru/api/get_track/${Settings.djid}"`, (err,stdout,stderr) => {
			if (stdout !== "null" && isJson(stdout)) {
				let currentSongData = JSON.parse(stdout);
				if (currentSong !== currentSongData.title) {
					currentSkip.clear();
					currentSong = currentSongData.title;
				}
				if (!currentSkip.has(user['user-id'])) {
					currentSkip.set(user['user-id'],'skip');
					if (currentSkip.size >= maxSkipCount) {
						exec(`curl \
							-X GET "https://streamdj.ru/api/request_skip/${Settings.djid}/${Settings.djtoken}"`, (err,stdout,stderr) => {
							if (stdout) {
								let data = JSON.parse(stdout);
								currentSkip.clear();
								client.say(Settings.channel, entities.decode(`/me > "${currentSongData.title}" успешно пропущен PogChamp`));
							}
						});
					}else client.say(Settings.channel, entities.decode(`/me > ${u.username} Твой голос учтен, голосов для пропуска ${currentSkip.size}/${maxSkipCount}`));
				}else client.say(Settings.channel, entities.decode(`/me > ${u.username} Ты уже проголосовал за пропуск этого трека!`));
			}else client.say(Settings.channel, entities.decode(`/me > ${u.username} Сейчас ничего не играет!`));
		});
	}
	if (message === "!banskip" || message === "!банскип") {
		if (user.badges.moderator || user.badges.broadcaster) {
			exec(`curl \
				-X GET "https://streamdj.ru/api/get_track/${Settings.djid}"`, (err,stdout,stderr) => {
				if (stdout !== "null" && isJson(stdout)) {
					let currentSongData = JSON.parse(stdout);
						exec(`curl \
							-X GET "https://streamdj.ru/api/request_skip/${Settings.djid}/${Settings.djtoken}"`, (err,stdout,stderr) => {
							if (stdout) {
								let data = JSON.parse(stdout);
								currentSkip.clear();
								client.say(Settings.channel, entities.decode(`/me > ${u.username} успешно пропустил трек, по причине банворд D:`));
							}
						});
				}else client.say(Settings.channel, entities.decode(`/me > ${u.username} Сейчас ничего не играет!`));
			});
		}else client.say(Settings.channel, entities.decode(`/me > ${u.username} ты хто?`));
	}
	if (message === "!np" || message === "!нп" || message === "!карта" || message === "!map" || message === "!мап") {
		exec(`curl \
			-X GET "http://localhost:24050/json"`, (err,stdout,stderr) => {
			if (stdout !== "null" && !err && isJson(stdout)) {
				let data = JSON.parse(stdout),
					bm = data.menu.bm,
					mapd = bm.metadata,
					mapLink = (bm.id !== 0) ? `(https://osu.ppy.sh/beatmaps/${bm.id})` : `(карты нет на сайте)`;
				client.say(Settings.channel,entities.decode(`/me > ${u.username} Сейчас играет ${mapd.artist} - ${mapd.title} [${mapd.difficulty}] ${mapLink}`));
			}else client.say(Settings.channel, entities.decode(`/me > ${u.username} Эта команда сейчас недоступна :(`));

		});
	}
	if (message === "!iq") {
		function randomInteger(min, max) {
			let rand = min - 0.5 + Math.random() * (max - min + 1);
			return Math.round(rand);
		}
		let randIq = randomInteger(1,250);
		if (u.username === "rowario") randIq = 99999999999999999;
		client.say(Settings.channel, entities.decode(`/me > ${u.username} твой IQ ${randIq}`));
	}
	if (message === "!leaderboard" || message === "!лидерборд" || message === "!top" || message === "!топ") {
		let topUsers = await getLeaderboard();
		let msg = `/me > `;
		await topUsers.forEach((item, i) => {
			if (i < 15) {
				let adder = (i == 0) ? "" : "|";
				msg += `${adder} #${i+1} ${item.display_name} (${item.level} lvl) `;
			}
		});
		client.say(Settings.channel, entities.decode(msg));
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

setInterval(function () {
	updateAllActiveUsers();
},59000);
setInterval(function () {
	updateRanks();
},30000);

clearAllUsersMessages();
