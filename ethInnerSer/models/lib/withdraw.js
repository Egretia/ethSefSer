var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Withdraw = {
    STATUS_CREATE : 1 ,
    STATUS_PENDING : 2 ,
    STATUS_SUCCESS : 3 ,
    STATUS_FAILED : 4 ,
    STATUS_ERROR : 5 
} ;

Withdraw.getByPlatformId = async (platform, platformId)=>{
    let sql = "select * from eth_withdraw where platform="+Mysql.escape(platform)+" and platform_id="+Mysql.escape(platformId)+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
}

Withdraw.updateById = async (data, id)=>{
    data["updated_at"] = (new Date()).getTime();

    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }

    let sql = "update eth_withdraw set "+fields.join(",")+" where id="+id+" limit 1" ;
    Utils.log.debug(sql) ;

    let result = await Query.sql_update(sql) ;
    return result ;
}

Withdraw.save = async (data)=>{

    data["created_at"] = (new Date()).getTime();

    let fields = [] ;
    let values = [] ;
    for(let key in data ){
        fields.push( key );
        values.push( Mysql.escape(data[key]) ) ;
    }

    let sql = "insert into eth_withdraw(`"+fields.join("`,`")+"`) values("+values.join(",")+")" ;
    Utils.log.debug(sql) ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

module.exports = Withdraw;