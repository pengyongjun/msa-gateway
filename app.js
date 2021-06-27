var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// 自定义开始位置
const PORT = 1234;
const zookeeper = require('node-zookeeper-client');

const CONNECTION_STRING = '47.243.173.250:2181, 47.243.173.250:2182, 47.243.173.250:2183';
const REGISTRY_ROOT = '/registry';

//连接ZooKeeper
const zk = zookeeper.createClient(CONNECTION_STRING);
zk.connect();

// 定义代理
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer();
proxy.on('error', function (error, request, response) {
    response.end();
});

//启动Web服务器
app.use(express.static('public'));
app.all('*', function (request, response) {
    // 图标
    if (request.path === '/favicon.ico') {
        response.end();
        return;
    }

    // 获取 service name
    const serviceName = request.get("Service-Name");
    console.log("Service name is: %s", serviceName);
    if (!serviceName) {
        console.log("Service-Name is needed in request header");
        response.write("Service-Name is needed in request header");
        response.end();
        return;
    }

    // 获取服务路径
    const servicePath = REGISTRY_ROOT + '/' + serviceName;
    console.log('servicePath: %s', servicePath);

    //获取服务路径下的地址节点
    zk.getChildren(servicePath, function (error, addressNodes) {
        if (error) {
            console.log("获取服务路径错误: %s", error.stack);
            response.end();
            return;
        }

        const size = addressNodes.length;
        if (size === 0) {
            console.log("服务路径不存在");
            response.end();
            return;
        }

        // 构造地址路径
        let addressPath = servicePath + "/";
        addressPath += (size === 1 ? addressNodes[0] : addressNodes[parseInt(Math.random() * size)]);
        console.log('addressPath: %s', addressPath);

        // 获取服务地址
        zk.getData(addressPath, function (error, serviceAddress) {
            if (error) {
                console.log("获取服务地址失败： %s", error.stack);
                response.end();
                return;
            }

            console.log("服务地址是: %s", serviceAddress);
            if (!serviceAddress) {
                console.log("服务地址为空！");
            }

            // 执行反向代理
            proxy.web(request, response, {
                target: 'http://' + serviceAddress
            });
        });
    });
});

app.listen(PORT, function () {
    console.log('server is running at %d', PORT);
});

// 自定义结束位置

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
