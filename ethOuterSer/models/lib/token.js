var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Token = {}

Token.getBySymbol = async (symbol)=>{
    let sql = "select * from eth_token where symbol="+Mysql.escape(symbol)+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
} ;

Token.getBalanceInfoBySymbol = async (symbol, addr)=>{
    let info = await Query.sql_select("select * from eth_token_balance where symbol="+Mysql.escape(symbol)+" and address="+Mysql.escape(addr)) ;
    if(!info || info.length<=0){
        return false;
    }
    return info[0];
}

Token.updateBalanceCollected = async (symbol, addr, collectedNum, balanceNow)=>{

    let conn = await Query.atom_getconn() ;
    if (!conn){
        conn.release();
        return false ;
    }

    if(!await Query.atom_begin(conn)) {
        conn.release();
        return false ;
    }
    
    try{
        // lock table for update
        var info = await Query.atom_select("select * from eth_token_balance where symbol="+conn.escape(symbol)+" and address="+conn.escape(addr)+" FOR UPDATE", conn) ;
        info = info[0];
        info.collected = parseFloat(info.collected) + parseFloat(collectedNum) ;
        info.balance = parseFloat(balanceNow);
        
        let sqlUp = "update eth_token_balance set collected='"+info.collected+"' where id="+info.id ;
        if(! await Query.atom_update(sqlUp, conn)) {
            
            throw new Error("update eth_token_balance failed");
        }

        await Query.atom_commit(conn) ;
    }catch(e){
        Utils.log.error(e.message) ;
        console.error(e) ;
        await Query.atom_rollback(conn) ;
        conn.release();
        return false;
    }

    conn.release();
    return info;
} ;

Token.saveBalance = async (symbol, addr, balance)=>{

    let conn = await Query.atom_getconn() ;
    if (!conn){
        conn.release();
        return false ;
    }

    if(!await Query.atom_begin(conn)) {
        conn.release();
        return false ;
    }
    
    try{
        // lock table for update
        var info = await Query.atom_select("select * from eth_token_balance where symbol="+conn.escape(symbol)+" and address="+conn.escape(addr)+" FOR UPDATE", conn) ;
        
        if (!info || info.length<=0){
            info = {
                symbol:symbol,
                address:addr,
                balance:balance,
                collected:0,
                created_at:(new Date()).getTime(),
                updated_at:0
            } ;
            
            let insertId = await Query.atom_insert_ex("eth_token_balance", info, conn) ;
            if(!insertId || insertId<=0){
                throw new Error("save eth_token_balance failed");
            }
            info.id = insertId ;
        }else{
            info = info[0];
            if(info.balance!=balance){
                info.balance = balance ;
                
                let sqlUp = "update eth_token_balance set balance='"+info.balance+"' where id="+info.id ;
                if(! await Query.atom_update(sqlUp, conn)) {
                    
                    throw new Error("update eth_token_balance failed");
                }
            }
        }

        await Query.atom_commit(conn) ;
    }catch(e){
        Utils.log.error(e.message) ;
        console.error(e) ;
        await Query.atom_rollback(conn) ;
        conn.release();
        return false;
    }

    conn.release();
    return info;
} ;

module.exports = Token