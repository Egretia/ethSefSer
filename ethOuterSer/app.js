var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');


// 初始化配置文件
Config = require('./config');
Config.init();

// 依赖配置文件：依赖 Config
Models = require("./models") ;

// 开启以太坊区块订阅：依赖 Models
Subscribe = require("./subscribe");
SubHeader = new Subscribe();

// 设置监听端口
process.env.PORT = Config.main.listenPort ;
process.env.addEthGas = 0 ; // 代替个锁机制，汇总币的时候需要从大钱包转账，那个操作不能并行

process.on('uncaughtException', (err) => {
  console.log('捕获到异常,即将结束进程：', err);
  process.exit() ;
});

process.on('unhandledRejection', (reason, p) => {
  console.log('未处理的 rejection,即将结束进程：', p, '原因：', reason);
  // 记录日志、抛出错误、或其他逻辑。
  process.exit() ;
});

process.on('SIGINT', async function() {
  console.log("recive SIGINT");
  let isok = await Models.query.close() ;
  process.exit(isok ? 0 : 1);
});

var index = require('./routes/index');
var service = require('./routes/service');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/service', service);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
