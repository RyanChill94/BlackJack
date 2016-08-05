/**
 * Created by Ryanchill on 2016/4/10.
 */
var express = require('express'),
    app     = express(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server);

var users         = [],     //玩家队列
    usersNickname = [],     //用户名队列 防止用户名重名
    ready_num     = 0,      //准备人数
    aCard         = [],     //卡片数组
    aEnd          = [0, 0]; //结束标记数组

//常量定义
var STATUS_INIT = 0,
    STATUS_READY = 1,
    STATUS_START = 2;

//指定默认的路由
app.use('/', express.static(__dirname + '/www'));

server.listen(3000);//绑定端口
console.log("服务端已经启动--------->监听3000端口");


/*socket 部分*/
io.sockets.on('connection', function (socket) {
    //新用户登入
    socket.on('login', function (nickname) {
        var pid = this.id;
        if (usersNickname.indexOf(nickname) > -1) {
            //用户名重复
            socket.emit('nickExisted');
        } else {

            usersNickname.push(nickname);
            //挂载属性
            socket.nickname = nickname;

            //初始化玩家信息
            var player = {
                "id": pid,
                "nickname": nickname,
                "status": STATUS_INIT
            };
            users[pid] = player;
            socket.emit('loginSuccess');

            //发布登录成功
            io.sockets.emit('system', socket.nickname, getUserInfo(pid), usersNickname, 'login');
        }

    });

    //用户离线
    socket.on('disconnect', function () {
        var pid = this.id;
        //离线用户从姓名队列移除
        usersNickname.splice(getPlayerIndex(this.nickname), 1);
        if (users[pid].status == STATUS_READY) {
            ready_num--;
        }
        delete  users[pid];

        //发送一个system事件
        socket.broadcast.emit('system', socket.nickname, getUserInfo(pid), usersNickname, 'logout');
    });

    //发布新消息
    socket.on('postMsg', function (msg) {
        socket.broadcast.emit('newMsg', socket.nickname, msg);
    });

    //玩家准备
    socket.on('onReady', function (pos) {
        var pid = this.id;
        console.log("准备玩家的位置" + pos);

        if (users[pid] && users[pid].status == STATUS_INIT) {
            users[pid].status = STATUS_READY;
            ready_num++;
            aCard[pos] = [];
            //生成随机数
            getRandomNum(aCard[pos], 1, 52, 2);
        }
        socket.emit('ready', socket.nickname, users[pid],ready_num);
        socket.broadcast.emit('ready', socket.nickname, users[pid],ready_num);

        //游戏开始
        if (ready_num == 2) {

            socket.emit("start", {userNickname:usersNickname, aCard:aCard});
            socket.broadcast.emit("start", {userNickname:usersNickname, aCard:aCard});

        }
    });

    //加牌
    socket.on('onAdd', function (pos) {
        addOneCard(aCard[pos]);
        socket.emit("add", aCard, pos);
        socket.broadcast.emit("add", aCard, pos);
    });

    //游戏结束
    socket.on('onEnd', function (pos) {
        //socket.emit('end',usersNickname,pos);
        socket.broadcast.emit('end', usersNickname, pos);
    });

    //玩家放弃加牌
    socket.on('onFinish', function (pos) {
        aEnd[pos] = 1;

        if (aEnd[0] && aEnd[1]) {
            socket.broadcast.emit('finish', usersNickname, aCard);
        }
    });

    /*工具类*/
    function getPlayerIndex(nickname) {
        return usersNickname.indexOf(nickname);
    }

    function getUserInfo(pid) {
        return users[pid];
    }

    /*获得 1-52中随机两个数*/
    function getRandomNum(array, min, max, num) {
        for (var i = 0; i < num; i++) {
            var random = Math.floor(Math.random() * max + min);
            if (!isExist(array, random)) {
                array.push(random);
            } else {
                i--;
            }

        }
    }

    function addOneCard(array) {
        getRandomNum(array, 1, 52, 1)
    }

    function isExist(array, num) {
        if(array.indexOf(num) > 0) {
            return true;
        }
        return false;
    }


});