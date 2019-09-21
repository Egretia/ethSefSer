const nsq = require('nsqjs')

class Consumer {
    constructor(){
        const reader = new nsq.Reader('test', 'test_c', {
            lookupdHTTPAddresses: '192.168.1.202:4161'
          })
           
          reader.connect()
           
          reader.on('message', msg => {
            console.log('Received message [%s]: %s', msg.id, msg.body.toString())
            msg.finish()
          })
    }
}

module.exports = Consumer