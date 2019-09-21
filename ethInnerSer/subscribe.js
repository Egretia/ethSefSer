const Web3 = require('web3');
const WebSocket = require("ws");
const Http = require('http');
const EventHelper = require("./events/event-helper")
const Utils = require("./utils")

class Subscribe {
    constructor(){
        this.txs = [] ; // {txhash:{hash:xxx,event:xxx,[params:{...}]}}

        (async()=>{
            let _txs = await Models.query.sql_select("select hash,event_content from eth_tx where status="+Models.tx.STATUS_PENDDING);
            if(_txs){
                for(let i in _txs){
                    this.txs[_txs[i].hash] = JSON.parse(_txs[i].event_content) ;
                }
            }
        })() ;

        this.web3 = new Web3();
        this.web3.setProvider(new Web3.providers.HttpProvider(Config.main.subscribeHttp));

        this.ws = null ;

        this.initWs(Config.main.subscribeWs);
    }

    addTx(hash,eventContent){
        this.txs[hash] = eventContent
        
    }

    txExists(hash){
        return typeof(this.txs[hash])!="undefined" ;
    }

    syncByBlockNum(number){
        this.web3.eth.getBlock(number, true, (err, blockEty)=>{
            if(err){
                console.error(`get ${number} block Entity err:`,err)
                Utils.log.error(`get ${number} block Entity err:`,err.message)
            }else{
                
                if(!blockEty){
                    
                    Utils.log.error(`block ${number} is null `)
                }else{
                    if(blockEty.transactions.length>0){
                        
                        for(let i in blockEty.transactions){
                            let txEty = blockEty.transactions[i] ;
                            
                            
                            if(txEty.hash){
                                if(this.txExists(txEty.hash)){
                                    
                                    this.dealTx(txEty);
                                }
                            }

                        }
                    }
                }
            }
        });
    }

    dealTx(txEty){
        // this.notifyTransfer(txEty);
        // this.txs[hash],txEty
        EventHelper.txEventCallback(this.txs[txEty.hash], txEty) ;
    }

    dealNewBlock(newHeader,times){
        let number = this.web3.toDecimal(newHeader.number);
        Utils.log.info(`recv new header  ${number}`)
        number = number-5 ;
        
        Utils.log.info(`try to get block ${number}`)
        this.syncByBlockNum(number);
    }

    initWs(url){
        console.log("Ws inited")
        var ws = new WebSocket(url) ;
        ws.onopen = (e)=>{
            ws.send('{"jsonrpc":"2.0", "id": 1, "method": "eth_subscribe", "params": ["newHeads"]}');
        }
        ws.onclose = (e)=>{
            console.error(e)
            Utils.log.error("ws closed,will reconnect...")
            ws = this.initWs(url) ;
        }
        ws.onerror = (e)=>{
            console.error(e)
            Utils.log.error("ws occured error,will reconnect..."+e.message)
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
                Utils.log.error(`ws message error ${err.message}`)
            }
            
        }
        this.ws = ws;
    }
}

module.exports = Subscribe