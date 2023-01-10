import { RouterInfo } from '../lib/';

!(async () => {
    const router = new RouterInfo('192.168.1.1');
    console.log(await router.authenticate('admin', 'admin'))
    console.log(await router.getUptime());
    console.log(await router.getUptimeSecs());
    console.log(await router.getMemoryUsage());
    console.log(await router.getCPUUsage());
    console.log(await router.getClientsFullInfo());
    console.log(await router.getWanStatus());
    console.log(await router.isWanOnline());
    console.log(await router.getSettings());
    console.log(await router.getLanIPAddress());
    console.log(await router.getLanNetmask());
    console.log(await router.getLanGateway());
    console.log(await router.getDHCPList());
    console.log(await router.getOnlineClients());
    console.log(await router.getClientInfo('00:00:00:00:00:00'));
})();
