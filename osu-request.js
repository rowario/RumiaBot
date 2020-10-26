const Settings = require('./config/settings.json'),
    fs = require('fs'),
    {exec} = require('child_process'),
    {BanchoClient} = require("bancho.js"),
    osu = require('node-osu'),
    request = require('request'),
    osuApi = new osu.Api(Settings.osuToken, {
        notFoundAsError: true,
        completeScores: true,
        parseNumeric: false
    }),
    banchoIrc = new BanchoClient({ username: Settings.osuIrcLogin, password: Settings.osuIrcPass }),
    banchoUser = banchoIrc.getSelf();

banchoIrc.connect().then(() => {
    console.log(`Connected to bancho!`);
})

function getMods(message) {
    let arrIndexes = ['hd','dt','nc','hr','ez','nf','ht','v2'],
        existMods = [],
        msgParse = (message !== undefined) ? message.replace(["https://"],"") : toString(message);
    for (let item of arrIndexes) if (msgParse.indexOf(item) + 1) if (!existMods.indexOf(item) + 1) existMods.push(item);
    return (existMods.length > 0) ? ` +${existMods.join('')}` : ``;
}

function getBpm(baseBpm,message) {
    let existMods = getMods(message);
    let dtCheck = (existMods.indexOf('dt') + 1) || (existMods.indexOf('nc') + 1) ? parseInt(baseBpm * 1.5) : parseInt(baseBpm);
    return (existMods.indexOf('ht') + 1) ? parseInt(dtCheck * 0.75) : parseInt(dtCheck);
}

function getOsuFile(beatmap_id) {
    return new Promise( res => {
        let file_name = `./beatmaps/${beatmap_id}.osu`;
        if (!fs.existsSync(file_name)) {
            request({url: `https://osu.ppy.sh/osu/${beatmap_id}`}, (error, response, body) => {
                if (!error && body !== "null") {
                    fs.writeFile(file_name, body, (err) => {
                        if (err) res(false);
                        res(file_name);
                    })
                }
            });
        }else res(file_name);
    });
}

async function getOppaiData(beatmap_id,mods = "",acc) {
    return new Promise(async res => {
        let file_name = await getOsuFile(beatmap_id);
        exec(`"./oppai.exe" "${file_name}" ${mods} ${acc}%`, function (err,stdout) {
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

module.exports.sendRequest =  function (linkInfo, username, osuLink,customText = "") {
    let defaultFormat = `{custom} {username} > {dllink} {bclink} {mods} {mapstat}`;
    return new Promise(res => {
        let getMapConfig = (linkInfo.type === "b") ? { b: linkInfo.id } : { s: linkInfo.id };
        osuApi.getBeatmaps(getMapConfig).then( async beatmaps => {
            if (!beatmaps[0]) return;
            let mapInfo = beatmaps[0],
                oppaiData = [],
                ppAccString = [],
                mods = getMods(osuLink).toUpperCase();
            for await (let acc of [95,98,99,100]) {
                let getOppai = await getOppaiData(mapInfo.id,mods,acc);
                oppaiData.push(getOppai);
                ppAccString.push(`${acc}%: ${getOppai.pp}PP`);
            }
            let starRate = (oppaiData[0]) ? parseFloat(oppaiData[0].stats.sr).toFixed(2) : parseFloat(mapInfo.difficultyrating).toFixed(2),
                genMsg = defaultFormat
                    .replace(/{custom}/,customText)
                    .replace(/{username}/,username)
                    .replace(/{dllink}/,`[https://osu.ppy.sh/b/${mapInfo.id} ${mapInfo.artist} - ${mapInfo.title}]`)
                    .replace(/{bclink}/,`[https://bloodcat.com/osu/s/${mapInfo.beatmapSetId} BC]`)
                    .replace(/{mods}/,mods)
                    .replace(/{mapstat}/,`(${getBpm(mapInfo.bpm,osuLink)} BPM, ${starRate}⭐, ${ppAccString.join(', ')})`);
            await banchoUser.sendMessage(genMsg.trim());
            res({
                "title": mapInfo.title,
                "artist": mapInfo.artist,
                "mods": mods
            });
        });
    })
};

module.exports.sendMessage = async function (message) {
    await banchoUser.sendMessage(message.trim());
}
module.exports.getOppaiData = getOppaiData;