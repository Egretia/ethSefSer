const Web3 = require('web3');
const WebSocket = require("ws");
const Http = require('http');
const Models = require("./models");

class Subscribe {
    constructor(){

        this.alladdr = [] ; // 数据库中地址缓存
        
        this.inchargeCallback = Config.main.inchargeCallback ;
        this.pkey = Config.main.pKey;

        (async()=>{
            let users = await Models.query.sql_select("select address from address where status=1");
            if(users){
                for(let i in users){
                    this.alladdr[users[i].address] = true
                }
            }
        })() ;

        this.web3 = new Web3();
        this.web3.setProvider(new Web3.providers.HttpProvider(Config.main.subscribeHttp));
    
        this.requestId = 10 ;
        this.requests = [] ;
        this.ws = null ;

        this.tokenAddrs = [
            Config.main.tokenAddr, // egt
            Config.main.edeTokenAddr //ede
        ] ;

        this.initWs(Config.main.subscribeWs);
    }

    isTokenAddr(addr){
        return this.tokenAddrs.indexOf(addr)>=0 ;
    }

    addrExists(addr){
        return typeof(this.alladdr[addr])!="undefined" ;
    }

    getAddrInfo(addr){
        return this.alladdr[addr] ;
    }

    addAddr(addr){
        this.alladdr[addr] = true
    }

    dealNewBlock(newHeader,times){
        let number = this.web3.toDecimal(newHeader.number);
        console.log("recv new header ", number);
        number = number-5 ;
        console.log("try get header ", number);
        // 获取 5 个块之前
        this.web3.eth.getBlock(number, true, (err, blockEty)=>{
            if(err){
                console.error(`get ${number} block Entity err:`,err)
            }else{
                
                if(!blockEty){
                    console.log(`block ${number} is null `);
                    
                }else{
                    if(blockEty.transactions.length>0){
                        for(let i in blockEty.transactions){
                            let txEty = blockEty.transactions[i] ;

                            if(txEty.to){
                                if(this.addrExists(txEty.to)){
                                    this.dealTx(txEty,1);
                                }
                            }

                        }
                    }
                }
            }
        });
    }

    async notifyTransfer(tx){
        let addr = tx.to;
        Http.get(this.inchargeCallback+"?p_key="+this.pkey+"&address="+addr, (res) => {
            console.log("incharge callback done http code : ", res.statusCode) ;
        }).on('error', (e) => {
            console.error(`incharge callback err: ${e.message}`);
        });

    }

    dealTx(txEty,times){
        this.notifyTransfer(txEty);
    }

    initWs(url){
        console.log("Ws inited")
        var ws = new WebSocket(url) ;
        ws.onopen = (e)=>{
            ws.send('{"jsonrpc":"2.0", "id": 1, "method": "eth_subscribe", "params": ["newHeads"]}');
        }
        ws.onclose = (e)=>{
            console.error(e)
            console.log("ws closed,will reconnect...")
            ws = this.initWs(url) ;
        }
        ws.onerror = (e)=>{
            console.error(e)
            console.log("ws occured error,will reconnect...")
            ws = this.initWs(url) ;
        }
        ws.onmessage = (e)=>{            
            try{
                let data = JSON.parse(e.data);
                
                if(data.method =='eth_subscription'){
                    
                    this.dealNewBlock(data.params.result,1);
                }
            }catch(err){
                console.error(err);
            }
            
        }
        this.ws = ws;
    }
}

module.exports = Subscribe