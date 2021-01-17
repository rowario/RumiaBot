const twitchClient = require("../utils/twitchClient");
const Rewards = require("../utils/rewards");

const Redeem = async (channel, username, reward, tags, message) => {
    // TODO
    const command = message.split(" ");
    const allCommands = ["!bind", "!unbind"];

    if (allCommands.indexOf(command[0]) !== -1) {
        if (tags.badges.broadcaster || tags.badges.moderator) {
            switch (command[0]) {
                case "!bind":
                    let binded = await Rewards.bindReward(reward, command);
                    twitchClient.say(
                        channel,
                        binded
                            ? `/me > ${username} награда успешно подключена!`
                            : `/me > ${username} не удалось подключить награду!`
                    );
                    break;
                case "!unbind":
                    let unbinded = await Rewards.unbindReward(reward);
                    twitchClient.say(
                        channel,
                        unbinded
                            ? `/me > ${username} награда успешно отключена!`
                            : `/me > ${username} не удалось отключить награду!`
                    );
                    break;
            }
        } else {
            twitchClient.say(
                channel,
                `/me > ${username} эта комманда только для модераторов!`
            );
        }
    } else {
    }
};

module.exports = Redeem;
