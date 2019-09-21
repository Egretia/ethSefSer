var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Platform = {

} ;

Platform.getByAccount = async (account)=>{
    let sql = "select * from eth_platform where p_account="+Mysql.escape(account)+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
}


module.exports = Platform;