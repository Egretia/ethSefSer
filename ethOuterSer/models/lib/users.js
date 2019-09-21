var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var User = {
    STATUS_NORMAL: 1 ,      // 正常
    STATUS_COLLECTING: 2    // EGT汇总中
} ;

User.updateBalance = async (addr, balance)=>{
    let sql = "select * from address where address='"+addr+"' limit 1" ;
    let result = await Query.sql_select(sql) ;
    if(result.length<=0){
        return false;
    }
    let userinfo = result[0] ;
    userinfo.balance = balance ;
    userinfo.topup_at = parseInt((new Date()).getTime()/1000) ;
    
    result = await User.updateById(userinfo.id, {
        balance: userinfo.balance ,
        topup_at: userinfo.topup_at
    }) ;

    if(!result){
        return false;
    }

    return userinfo ;
}

User.updateBalanceCollected = async (uid, collectedNum) =>{
    let sql = "select * from address where id="+uid+" limit 1" ;
    let result = await Query.sql_select(sql) ;
    let userinfo = result[0] ;
    let value = parseFloat(userinfo.collected)+parseFloat(collectedNum) ;
    result = await User.updateById(uid, {
        collected: value,
        status: User.STATUS_NORMAL 
    }) ;
    return result ;
}

User.updateById = async (uid, data) =>{
    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }
    let sql = "update address set "+fields.join(",")+" where id="+uid;
    let result = await Query.sql_update(sql) ;
    return result ;
}

User.getByAddress = async (address)=>{
    let sql = "select * from address where address="+Mysql.escape(address)+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
}

User.save = async (data)=>{

    data["created_at"] = (new Date()).getTime();

    let fields = [] ;
    let values = [] ;
    for(let key in data ){
        fields.push( key );
        values.push( Mysql.escape(data[key]) ) ;
    }

    let sql = "insert into address(`"+fields.join("`,`")+"`) values("+values.join(",")+")" ;
    Utils.log.debug(sql) ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

User.saveMore = async (datalist)=>{
    if(length(datalist)<=0){
        return false
    }

    let now = (new Date()).getTime();
    let fields = [] ;
    for(let key in datalist[0] ){
        fields.push( key );
    }
    let values = [] ;
    for (let i in datalist) {
        let data = datalist[i]
        data["created_at"] = now;

        let value = [] ;
        for(let key in data ){
            
            value.push( Mysql.escape(data[key]) ) ;

            
        }
        
        values.push("("+values.join(",")+")") ;
    }

    let sql = "insert into address(`"+fields.join("`,`")+"`) values"+values.join(",") ;
    Utils.log.debug(sql) ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

module.exports = User;