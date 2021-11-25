const axios = require('axios');
const express = require('express');
const app = express();
require('dotenv').config();
const ElectrumCli = require('electrum-client')
const client = require('prom-client');
axios.defaults.timeout = parseInt(process.env.AXIOS_TIMEOUT);

const electrumxHost = process.env.ELECTRUMX_HOST;
const electrumxPort = process.env.ELECTRUMX_PORT;

electrumxUpGauge = new client.Gauge({ name: 'electrumx_up', help: 'status of electrumx server', labelNames: ['coin']});
currentBlockGauge = new client.Gauge({ name: 'electrumx_current_block_height', help: 'height of current block on electrumx server', labelNames: ['coin'] });
electrumxLastUpdateGauge = new client.Gauge({ name: 'electrumx_last_update_seconds', help: 'electrumx_last_update_seconds', labelNames: ['coin'] });
requestCounts = new client.Gauge({ name: 'electrumx_request_count', help: 'number of requests to electrumx server', labelNames: ['coin', 'method'] });
sessionCounts = new client.Gauge({ name: 'electrumx_session_count', help: 'number of sesstions to electrumx server', labelNames: ['coin', 'method'] });
requestTotal = new client.Gauge({ name: 'electrumx_total_request_count', help: 'number of total requests to electrumx server', labelNames: ['coin'] });
txsSent = new client.Gauge({ name: 'electrumx_txs_sent_count', help: 'number of txs sent of electrumx server', labelNames: ['coin'] });
daemonStartTimeGauge = new client.Gauge({ name: 'electrumx_daemon_start_time', help: 'electrumx server startTime', labelNames: ['coin'] });

async function updateMetrics() {
    console.log('ecl connecting');
    const ecl = new ElectrumCli(electrumxPort, electrumxHost, 'tcp') // tcp or tls
    try {
        await ecl.connect() // connect(promise)
        const info = await ecl.request('getinfo')
        console.log('ecl connected without error');
        console.log('///////////////////////////');
        electrumxUpGauge.set({ coin: info.coin }, 1);
        currentBlockGauge.set({ coin: info.coin }, info['db height']);
        requestTotal.set({ coin: info.coin }, info['request total']);
        txsSent.set({ coin: info.coin }, info['txs sent']);
        electrumxLastUpdateGauge.set({ coin: info.coin }, Math.floor(Date.now() / 1000));


        // daemon utc start_time
        var finalSeconds = 0;
        var electrumxUptime = info['uptime'];
        var times = electrumxUptime.split(' ');
        
        for (const i of times) {
            if (i.split(/([0-9]+)/)[2] == 'd') {
                finalSeconds += parseInt(i.split(/([0-9]+)/)[1]) * 86400;
            }
            if (i.split(/([0-9]+)/)[2] == 'h') {
                finalSeconds += parseInt(i.split(/([0-9]+)/)[1]) * 3600;
            }
            if (i.split(/([0-9]+)/)[2] == 'm') {
                finalSeconds += parseInt(i.split(/([0-9]+)/)[1]) * 60;
            }
            if (i.split(/([0-9]+)/)[2] == 's') {
                finalSeconds += parseInt(i.split(/([0-9]+)/)[1]);
            }
        }
        
        daemonUptime = new Date(Date.now() - (finalSeconds * 1000));
        daemonStartTimeGauge.set({ coin: info.coin }, daemonUptime.getTime()/1000);

        //  
        for(const [request, count] of Object.entries(info['request counts'])) {
            requestCounts.set({ coin: info.coin, method: request }, count);
        }
        for(const [request, count] of Object.entries(info['sessions'])) {
            sessionCounts.set({ coin: info.coin, method: request }, count);
        }
    } catch (e) {
        console.log(e);
        console.log('error on ecl connection');
        electrumxUpGauge.set({ coin: process.env.COIN }, 0);
    }
    await ecl.close() // disconnect(promise)
}

//app
app.get('/metrics', async (req, res) => {
    metrics = await client.register.metrics();
    return res.status(200).send(metrics);
});

app.listen(process.env.LISTEN_PORT, () => console.log('Server is running and metrics are exposed on http://URL:3000/metrics'));

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(){
   while(true){
       await Promise.all([updateMetrics(), delay(process.env.REFRESH_INTERVAL_MILLISECONDS)]);
    }
}

main();
