const fs=require("fs")

var config = {
    db:{},
    main:{},
    errmsg:{}
};
config.init = ()=>{
    
    config.db = JSON.parse(fs.readFileSync(__dirname+"/res/db.json"));
    config.main = JSON.parse(fs.readFileSync(__dirname+"/res/main.json"));
    config.errmsg = JSON.parse(fs.readFileSync(__dirname+"/res/errmsg.json"));
};

module.exports = config ;