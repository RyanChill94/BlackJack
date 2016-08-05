/**
 * Created by Ryanchill on 2016/4/10.
 */

window.onload = function () {

    var blackJack = new BlackJack();
    blackJack.init();
};

function BlackJack() {

    this.socket = null;
}

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

BlackJack.prototype = {


    //初始化
    init: function () {
        var that = this;
        var name = "";
        var playerPos = -1;
        var aReady = $$(".btn-ready"), oAdd = $$(".btn-add"), oEnd = $$(".btn-end");
        var readyNum = 0;

        /*-------------------------------
         *
         * socket
         * server handler
         *
         * -------------------------------*/
        //连接服务器
        this.socket = io.connect();

        //监听连接事件
        this.socket.on('connect', function () {
            $('#info').textContent = '请输入你的昵称';
            document.getElementById('nickWrapper').style.display = 'block';
            document.getElementById('nicknameInput').focus();
        });

        //响应服务器的断开连接事件
        this.socket.on('disconnect', function () {

        });

        //重名
        this.socket.on('nickExisted', function () {
            document.getElementById('info').textContent = '重名啦，换个名字 :)';
        });

        //登录成功
        this.socket.on('loginSuccess', function () {
            document.title = 'BlackJack | ' + document.getElementById('nicknameInput').value;
            document.getElementById('loginWrapper').style.display = 'none';


        });

        //登录失败
        this.socket.on('error', function (err) {
            if (document.getElementById('loginWrapper').style.display == 'none') {
                document.getElementById('status').textContent = '!fail to connect :(';
            } else {
                document.getElementById('info').textContent = '!fail to connect :(';
            }
        });

        //监听系统提示消息
        /*
         * 当前实例挂载的 nickname属性
         * */
        this.socket.on('system', function (nickName, userInfo, userNickname, type) {

            var play_nickname = document.getElementsByClassName("player-nickname");
            var play_status = document.getElementsByClassName("player-status");
            that._updateNameList(userNickname);
            if (userNickname.length > 1) {
                //需要更新视图
                play_nickname[0].textContent = userNickname[0];
            }

            var msg = nickName + (type == 'login' ? ' joined' : ' left');
            if (type == "login") {
                //登录
                var pos = userNickname.indexOf(play_nickname[0].textContent) > -1 ? 1 : 0;
                play_nickname[pos].textContent = nickName;
                play_status[pos].textContent = userInfo.status == 0 ? "未准备" : "已准备";
                event("bind");
            } else {

                //有玩家登出 恢复初始状态
                var delPos = (play_nickname[0].textContent == nickName) ? 0 : 1;
                play_nickname[delPos].textContent = "等待玩家接入";
                play_status[delPos].textContent = "未准备";
            }

            //发布系统消息
            that._displayNewMsg('system ', msg, 'red');

        });

        //监听消息
        this.socket.on('newMsg', function (user, msg) {
            that._displayNewMsg(user, msg);
        });

        //监听玩家发起的准备
        this.socket.on('ready', function (user, userInfo, rm) {
                that._updateReady(user, userInfo);
                readyNum = rm;
                console.log(readyNum);
            }
        );

        //游戏开始
        this.socket.on('start', function (json) {
            alert("游戏开始了");
            if ($$("#card-list-1 li").length == 0 && $$("#card-list-2 li").length == 0) {
                that._initCardList(json.userNickname, json.aCard);
                that._initScore(json.aCard);
            }
        });

        //加牌
        this.socket.on("add", function (aCard, pos) {
            that._addCardList(aCard, pos);
            that._initScore(aCard);
        });

        //游戏应一方点数过大结束
        this.socket.on("end", function (usersNickname, pos) {
            alert(usersNickname[pos] + "输了");
            //alert(usersNickname[1-pos] + "赢了");
            event("cancel");
        });

        //双方不加牌结束
        this.socket.on("finish", function (usersNickname, aCard) {
            var playerScore1 = that._countScore(aCard[0]);
            var playerScore2 = that._countScore(aCard[1]);
            //console.log(playerScore1);
            //console.log(playerScore2);
            if (playerScore1 > playerScore2) {
                alert(usersNickname[0] + "赢了");
            } else if (playerScore1 == playerScore2) {
                alert("打平了");
            } else {
                alert(usersNickname[1] + "赢了");
            }
            event("cancel");
        });


        /*-------------------------------------
         *
         *  client handler
         *
         * -------------------------------------*/

        //玩家登录
        $('#loginBtn').addEventListener('click', function () {
            var nickName = document.getElementById('nicknameInput').value;
            if (nickName.trim().length != 0) {
                that.socket.emit('login', nickName);
            } else {
                document.getElementById('nicknameInput').focus();
            }
        }, false);

        $('#nicknameInput').addEventListener('keyup', function (e) {
            if (e.keyCode == 13) {
                var nickName = this.value;
                if (nickName.trim().length != 0) {
                    that.socket.emit('login', nickName);
                }
            }
        }, false);

        //绑定按钮点击事件
        $('#btn-send').addEventListener('click', function () {
            var messageInput = $('#messageInput'),
                msg = messageInput.value;

            messageInput.value = '';
            messageInput.focus();
            if (msg.trim().length != 0) {
                //需要服务器给所有客户端广播
                that.socket.emit('postMsg', msg);
                that._displayNewMsg('me', msg);
                return false;
            }
        }, false);

        //绑定键盘事件
        $('#messageInput').addEventListener('keyup', function (e) {
            var messageInput = $('#messageInput'),
                msg = messageInput.value;

            if (e.keyCode == 13 && msg.trim().length != 0) {
                messageInput.value = '';
                that.socket.emit('postMsg', msg);
                that._displayNewMsg('me', msg);
            }
        }, false);

        $('#btn-clear').addEventListener('click', function () {
            $$('.messageBox')[0].innerHTML = '';
        }, false);


        function event(type) {
            name = (document.title).split("|")[1].toString().substring(1);
            //console.log($$('.player-nickname')[0].textContent,name);
            //console.log($$('.player-nickname')[0].textContent ==　name);
            playerPos = $$('.player-nickname')[0].textContent == name ? 0 : 1;

            var readyHandler = function () {
                $$(".player-status")[playerPos].textContent = "准备中";
                that.socket.emit('onReady', playerPos);
            };
            var addHandler = function () {
                if (readyNum < 2) {
                    alert("还没够人，再等等");
                } else {
                    alert("trigger");
                    that.socket.emit('onAdd', playerPos);
                }
            };
            var endHandler = function () {
                if (readyNum < 2) {
                    alert("还没开始你就不想玩");
                } else {
                    that.socket.emit('onFinish', playerPos);
                    this.setAttribute("disable", "disabled");
                }
            };
            if (type === "bind") {
                aReady[playerPos].addEventListener("click", readyHandler, false);
                oAdd[playerPos].addEventListener("click", addHandler, false);
                oEnd[playerPos].addEventListener("click", endHandler, false);
            } else if (type === "cancel") {
                //alert("i am trigger");
                aReady[playerPos].removeEventListener("click", readyHandler, false);
                oAdd[playerPos].removeEventListener("click", addHandler, false);
                oEnd[playerPos].removeEventListener("click", endHandler, false);
            }
        }

    },


    /* 工具类 */
    _updateNameList: function (userNickname) {
        var playList = '';
        for (var i = 0; i < userNickname.length; i++) {
            playList += (userNickname[i] + '  ');
        }
        document.getElementById("player-list").innerText = playList;
    },


    _displayNewMsg: function (user, msg, color) {
        var container = document.getElementsByClassName('messageBox')[0],
            msgToDisplay = document.createElement('p'),
            date = new Date().toTimeString().substr(0, 8);

        msgToDisplay.style.color = color;
        msgToDisplay.innerHTML = user + '<span class="time">(' + date + '): </span>' + msg;
        container.appendChild(msgToDisplay);
        container.scrollTop = container.scrollHeight;
    },

    _updateReady: function (user, userInfo) {
        var player_nickname = document.getElementsByClassName("player-nickname");
        var player_status = document.getElementsByClassName("player-status");
        var pos = player_nickname[0].textContent == user ? 0 : 1;
        var status = (userInfo.status == 1 ? "准备中" : "未准备");
        player_status[pos].textContent = status;
    },

    _initCardList: function (usersNickname, aCard) {
        //nikeName ["小明 小花"]   aCard[[1,6][8,50]]
        var playerList1 = $("#card-list-1");
        var playerList2 = $("#card-list-2");

        for (var i = 0; i < aCard[0].length; i++) {
            var li = document.createElement("li");
            li.className = 'card';
            var pokerClass = "poker" + aCard[0][i];
            li.innerHTML = '<img class=' + pokerClass + '>';
            playerList1.appendChild(li);
        }

        for (i = 0; i < aCard[1].length; i++) {
            li = document.createElement("li");
            li.className = 'card';
            pokerClass = "poker" + aCard[1][i];
            li.innerHTML = '<img class=' + pokerClass + '>';
            playerList2.appendChild(li);
        }

    },

    _addCardList: function (aCard, pos) {
        var playerList1 = document.getElementById("card-list-1");
        var playerList2 = document.getElementById("card-list-2");
        var li = document.createElement("li");
        li.className = 'card';
        var pokerClass = "poker" + aCard[pos][(aCard[pos].length) - 1];
        li.innerHTML = '<img class=' + pokerClass + '>';
        if (pos) {
            playerList2.appendChild(li);
        } else {
            playerList1.appendChild(li);

        }

    },

    _initScore: function (aCard) {
        //[[1,6][8,50]]
        this._updateScore(aCard[0], 0);
        this._updateScore(aCard[1], 1);

    },

    _updateScore: function (arrayCard, pos) {
        var playerScore = document.getElementsByClassName("score");
        var tempScore = this._countScore(arrayCard);
        if (tempScore > 21) {

            playerScore[pos].textContent = "你爆了";
            this.socket.emit('onEnd', pos);
        }
        playerScore[pos].textContent = tempScore;
    },

    _countScore: function (arrayCard) {
        var aFlag = false;
        var score = [];
        for (var i = 0; i < arrayCard.length; i++) {
            if (arrayCard[i] <= 4) {
                aFlag = true;
            }

            // 10 J Q K
            if (arrayCard[i] >= 37) {
                score.push(10);
            } else {
                if ((arrayCard[i] % 4) == 0) {
                    score.push(Math.floor(arrayCard[i] / 4));
                } else {
                    score.push(Math.floor(arrayCard[i] / 4) + 1);
                }
            }
        }
        var tempScore = this._sumUp(score);

        if (aFlag && tempScore < 21 && (tempScore + 10) <= 21) {
            tempScore += 10;
        }


        return tempScore;
    },

    _sumUp: function (array) {
        var sum = 0;
        for (var i = 0; i < array.length; i++) {
            sum += array[i];
        }
        return sum;
    }

};
