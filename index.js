const express = require("express");
const bodyParser = require("body-parser");
const EventEmitter = require("events");

class CSGOGSI extends EventEmitter {
    constructor({ port = 3000, authToken = "" }) {
        super();
        this.authToken = authToken;
        this.app = express();

        this.bombTime = 40;
        this.isBombPlanted = false;
        this.bombTimer = null;
        this.app.use(bodyParser.json());
        this.server = this.app.listen(port, () => {
            let addr = this.server.address();
            console.log(`[@] CSGO GSI server listening on ${addr.address}:${addr.port}`);
        });

        this.app.post("/", (req, res) => {
            if (typeof req.body !== "undefined") {
                // console.log(`auth: ${req.body["auth"]}`);
                if (this.isAuthenticated(req.body)) {
                    return res.writeHead(404);
                }

                this.emit("all", req.body);
                this.process(req.body);
                return res.writeHead(200);
            }

            return res.writeHead(404);
        });
    }

    isAuthenticated(data) {
        if (this.authToken.length < 1 || (typeof data["auth"]["token"] !== "undefined" && this.authToken.length > 0 && data["auth"]["token"] === this.authToken)) {
            return true;
        }

        return false;
    }

    process(data) {
        if (typeof data.map !== "undefined") {
            this.emit("gameMap", data.map.name);
            this.emit("gamePhase", data.map.phase); //warmup etc
            this.emit("gameRounds", data.map.round);
            this.emit("gameCTscore", data.map.team_ct_score);
            this.emit("gameTscore", data.map.team_t_score);
        }

        if (typeof data.player !== "undefined") {
            this.emit("player", data.player);
        }

        if (typeof data.round !== "undefined") {
            let maxTime = 0;
            this.emit("roundPhase", data.round.phase);
            switch (data.round.phase) {
                case "live":
                    maxTime = 115;
                    break;
                case "freezetime":
                    maxTime = 15;
                    break;
                case "over":
                    if (this.isBombPlanted) {
                        this.isBombPlanted = false;
                        this.stopC4Countdown();
                    }

                    this.emit("roundWinTeam", data.round.win_team);
                    break;
            }

            if (typeof data.round.bomb !== "undefined") {
                this.emit("bombState", data.round.bomb);
                switch (data.round.bomb) {
                    case "planted":
                        if (!this.isBombPlanted) {
                            this.isBombPlanted = true;
                            let timeleft = this.bombTime - (new Date().getTime() / 1000 - data.provider.timestamp);
                            this.emit("bombTimeStart", timeleft);
                            this.startC4Countdown(timeleft);
                        }

                        break;
                    case "defused":
                    case "exploded":
                        this.isBombPlanted = false;
                        this.stopC4Countdown();
                        break;
                }
            }
        }
    }

    stopC4Countdown() {
        if (this.bombTimer !== null) clearInterval(this.bombTimer);
    }

    startC4Countdown(time) {
        this.bombTimer = setInterval(() => {
            time = time - 1;
            if (time <= 0) {
                this.stopC4Countdown()
                self.isBombPlanted = false;
                return this.emit("bombExploded");
            }

            this.emit("bombTimeLeft", time);
        }, 1000);
    }
}

module.exports = CSGOGSI;