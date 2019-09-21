var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Wallet = {}

Wallet.getById = async (id)=>{
    let sql = "select * from eth_mnemonic where id="+Mysql.escape(id)+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
} ;

Wallet.save = async (data)=>{

    data["created_at"] = (new Date()).getTime();

    let fields = [] ;
    let values = [] ;
    for(let key in data ){
        fields.push( key );
        values.push( Mysql.escape(data[key]) ) ;
    }

    let sql = "insert into eth_mnemonic(`"+fields.join("`,`")+"`) values("+values.join(",")+")" ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

module.exports = Wallet