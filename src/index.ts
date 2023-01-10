import fetch from 'node-fetch';
import { HeadersInit } from 'node-fetch';

type UptimeResponse = {
    since: Date,
    uptime: number
};

type MemoryUsage = {
    mem_total: number,
    mem_free: number,
    mem_used: number
};

// TODO: I don't know what this looks like for routers with more or less cores, if asus just continues with this naming for the rest of the cores then we should make this an array of cores.
type CPUUsage = {
    cpu1_total: number,
    cpu1_usage: number,
    cpu2_total: number,
    cpu2_usage: number
};

enum ClientType {
    DEVICE = 0,
    UNK_1 = 1, // Unsure, ASUS-PC
    UNK_7 = 7,
    UNK_18 = 18, // Unsure, HP-GT5820 printer
    LINUX = 22,
    ROUTER = 24,
    UNK_34 = 34 // Unsure, ASUS_Phone 
};

enum IPMethod {
    STATIC = 'Manual',
    DHCP = 'Dhcp',
    MANUAL = 'Manual',
    OFFLINE = 'Offline'
};

enum OPMode {
    NONE,
    WIRELESS_ROUTER,
    OP_RE_ITEM,
    OP_AP_ITEM,
    OP_MB_ITME
};

// TODO: This pains me greatly but I don't know what to do. I can't start with a number.
enum WirelessBand {
    None,
    "2_4GHZ",
    "5GHZ"
};

enum InternetMode {
    ALLOW = 'allow',
    BLOCK = 'block',
    TIME = 'time'
};

type ClientInfo = {
    type: ClientType,
    defaultType: ClientType,
    name: string,
    nickName: string,
    ip: string,
    mac: string,
    from: string, // This could be an enum, but who cares (networkmapd, nmpClient)
    macRepeat: boolean,
    isGateway: boolean,
    isWebServer: boolean,
    isPrinter: boolean,
    isITunes: boolean,
    dpiType: string,        // "" on all my devices, these could be deep packet inspection related
    dpiDevice: string,      // "" on all my devices, I've seen "Linux" before
    vendor: string,
    isWL: WirelessBand,     // Is wireless
    isGN: string,           // Is on General Network(?)
    isOnline: boolean,      // Whether the device is actively connected
    ssid: string,
    isLogin: boolean,
    opMode: OPMode,         // Operation mode of the device(?)
    rssi: number,
    curTx: number,
    curRx: number,
    totalTx: number,
    totalRx: number,
    wlConnectTime: string,  // Example: 00:00::00
    ipMethod: IPMethod,     // How the device got it's IP address
    ROG: boolean,           // Whether the device is an ROG device
    group: string,          // "" on all my devices
    callback: string,       // "" on all my devices
    keeparp: string,        // "" on all my devices
    qosLevel: string,       // "" on all my devices
    wtFast: boolean,        // 0 on all my devices
    internetMode: InternetMode,
    internetState: number,  // 1 on all my devices
    amesh_isReClient: boolean, // 1 on all my devices
    amesh_papMac: string,   // The mac address of the connected mesh node
    amesh_bind_mac: string, // "" on all my devices
    amesh_bind_band: number // 0 on all my devices
};

type ClientFullInfo = {
    clientList: ClientInfo[],
    macList: string[],
    clientAPILevel: number  // Seems like it might be the version(?)
};

type Traffic = {
    sent: number,
    recv: number
};

// TODO: Look into this more, it doesn't follow the styling guidelines
type WanStatus = {
    status: number,
    statusstr: string,
    type: string,
    ipaddr: string,
    netmask: string,
    gateway: string,
    dns: string,
    lease: number,
    expires: number,
    xtype: string,
    xipaddr: string,
    xnetmask: string,
    xexpires: string,
};

type DHCPEntry = {
    mac: string,
    name: string
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class RouterInfo {
   url: string;
   ip: string;
   headers: HeadersInit | null;

    /**
     * Create the object and connect with the router
     * @param {string} ip Router IP Address
     */
    constructor(ip: string) {
        this.ip = ip;
        this.url = `http://${ip}/appGet.cgi`;
        this.headers = null;
    }

    /**
     * Authenticate with the router
     * @param {string} ip Router IP Address
     * @param {string} username Root username
     * @param {string} password Root password
     * @returns {boolean} Whether authentication was successful.
     */
    async authenticate(username: string, password: string): Promise<boolean> {
        const loginToken = Buffer.from(`${username}:${password}`).toString('base64');
        this.headers = {
            'user-agent': 'asusrouter-Android-DUTUtil-1.0.0.245',
            'content-type': 'application/x-www-form-urlencoded'
        };

        const req = await fetch(`http://${this.ip}/login.cgi`, {
            method: 'POST',
            headers: this.headers,
            body: `login_authorization=${loginToken}`
        });

        if (req.status !== 200) {
            return false;
        }

        const res: any = await req.json();
        if (!res.asus_token) {
            return false;
        }

        this.headers.cookie = `asus_token=${res.asus_token}`;
        return true;
    }

    /**
     * Private get method to execute a hook on the router and return the result
     * @param {string} command Command to send to the router
     * @returns {string|null} String result from the router or null
     */
    private async get(command: string): Promise<string | null> {
        if (this.headers === null) {
            return null;
        }

        const req = await fetch(this.url, {
            method: 'POST',
            headers: this.headers,
            body: `hook=${command}`
        });
        if (req.status !== 200) {
            return null;
        }

        return await req.text();
    }

    /**
     * Gets uptime of the router
     * @returns {UptimeResponse|null} an object with since and uptime, or null.
     */
    async getUptime(): Promise<UptimeResponse | null> {
        const r = await this.get('uptime()');
        if (r === null) {
            return null;
        }

        const since = r.split(':')[1].split('(')[0];
        const uptime = r.split('(')[1].split(' ')[0];

        return {
            since: new Date(since),
            uptime: Number(uptime)
        };
    }

    /**
     * Get the uptime of the router in seconds
     * @returns {number} Uptime in seconds
     */
    async getUptimeSecs() {
        const r = await this.get('uptime()');
        if (r === null) {
            return null;
        }

        const uptime = r.split('(')[1].split(' ')[0];

        return Number(uptime);
    }

    /**
     * Gets the memory usage of the router
     * @returns {MemoryUsage|null} Memory usage in bytes or null
     */
    async getMemoryUsage(): Promise<MemoryUsage | null> {
        const r = await this.get('memory_usage()');
        if (r === null) {
            return null;
        }

        // TODO: This will throw an error if the json is invalid.
        const usage = JSON.parse(`{${r.slice(17)}`);

        return {
            mem_total: Number(usage.mem_total),
            mem_free: Number(usage.mem_free),
            mem_used: Number(usage.mem_used)
        };
    }

    /**
     * Gets the CPU usage of the router
     * @returns {CPUUsage|null} CPU usage or null
     */
    async getCPUUsage(): Promise<CPUUsage | null> {
        const r = await this.get('cpu_usage()');
        if (r === null) {
            return null;
        }

        // TODO: This will throw an error if the json is invalid.
        const usage = JSON.parse(`{${r.slice(14)}`);

        return {
            cpu1_total: Number(usage.cpu1_total),
            cpu1_usage: Number(usage.cpu1_usage),
            cpu2_total: Number(usage.cpu2_total),
            cpu2_usage: Number(usage.cpu2_total)
        };
    }

    /**
     * Gets a full list of client information as well as the connected mac addresses and client api level.
     * @returns {ClientFullInfo|null} List of client information or null
     */
    async getClientsFullInfo(): Promise<ClientFullInfo | null> {
        const r = await this.get('get_clientlist()');
        if (r === null) {
            return null;
        }

        const clients = JSON.parse(r);
        const clientFullInfo: ClientFullInfo = {
            clientList: [],
            macList: clients.maclist,
            clientAPILevel: clients.ClientAPILevel
        };

        for (const mac in clients.get_clientlist) {
            if (mac === 'macList' || mac === 'ClientAPILevel') {
                continue;
            }

            const oldClient = clients.get_clientlist[mac];
            const client: ClientInfo = {
                type: Number(oldClient.type) as ClientType,
                defaultType: Number(oldClient.defaultType) as ClientType,
                name: oldClient.name,
                nickName: oldClient.nickName,
                ip: oldClient.ip,
                mac: oldClient.mac,
                from: oldClient.from,
                macRepeat: !!Number(oldClient.macRepeat),
                isGateway: !!Number(oldClient.isGateway),
                isWebServer: !!Number(oldClient.isWebServer),
                isPrinter: !!Number(oldClient.isPrinter),
                isITunes: !!Number(oldClient.isITunes),
                dpiType: oldClient.dpiType,
                dpiDevice: oldClient.dpiDevice,
                vendor: oldClient.vendor,
                isWL: Number(oldClient.isWL) as WirelessBand,
                isGN: oldClient.isGN,
                isOnline: !!Number(oldClient.isOnline),
                ssid: oldClient.ssid,
                isLogin: !!Number(oldClient.isLogin),
                opMode: Number(oldClient.opMode) as OPMode,
                rssi: Number(oldClient.rssi),
                curTx: Number(oldClient.curTx),
                curRx: Number(oldClient.curRx),
                totalTx: Number(oldClient.totalTx),
                totalRx: Number(oldClient.totalRx),
                wlConnectTime: oldClient.wlConnectTime,
                ipMethod: oldClient.ipMethod as IPMethod,
                ROG: !!Number(oldClient.ROG),
                group: oldClient.group,
                callback: oldClient.callback,
                keeparp: oldClient.keeparp,
                qosLevel: oldClient.qosLevel,
                wtFast: oldClient.wtfast,
                internetMode: oldClient.internetMode as InternetMode,
                internetState: oldClient.internetState,
                amesh_isReClient: !!Number(oldClient.amesh_isReClient),
                amesh_papMac: oldClient.amesh_papMac,
                amesh_bind_mac: oldClient.amesh_bind_mac,
                amesh_bind_band: oldClient.amesh_bind_band
            };

            clientFullInfo.clientList.push(client);
        }
        return clientFullInfo;
    }

    /**
     * Gets the total traffic since last restart in Megabits
     * @returns {Traffic|null} Sent and received Megabits since last boot or null
     */
    async getTotalTraffic(): Promise<Traffic | null> {
        const r = await this.get('netdev(appobj)');
        if (r === null) {
            return null;
        }

        const traffic = JSON.parse(r);
        const tx = parseInt(traffic.netdev.INTERNET_tx, 16) * 8 / 1024 / 1024 / 2;
        const rx = parseInt(traffic.netdev.INTERNET_rx, 16) * 8 / 1024 / 1024 / 2;

        return {
            sent: tx,
            recv: rx
        };
    }

    /**
     * Averages the network traffic over 2 seconds in Megabits
     * @returns {Traffic|null} Current network traffic in Mbit/s
     */
    async getTraffic(): Promise<Traffic | null> {
        const start = await this.get('netdev(appobj)');
        await sleep(2000);
        const end = await this.get('netdev(appobj)');
        if (start === null || end === null) {
            return null;
        }

        
        const startTraffic = JSON.parse(start);
        const endTraffic = JSON.parse(end);
        let tx = parseInt(endTraffic.netdev.INTERNET_tx, 16) * 8 / 1024 / 1024 / 2;
        tx -= parseInt(startTraffic.netdev.INTERNET_tx, 16) * 8 / 1024 / 1024 / 2;
        let rx = parseInt(endTraffic.netdev.INTERNET_rx, 16) * 8 / 1024 / 1024 / 2;
        rx -= parseInt(startTraffic.netdev.INTERNET_rx, 16) * 8 / 1024 / 1024 / 2;

        return {
            sent: tx,
            recv: rx
        };
    }

    /**
     * Gets the status of the current WAN link
     * @returns {WanStatus|null} Status information about the currnet WAN link or null
     */
    async getWanStatus(): Promise<WanStatus | null> {
        const r = await this.get('wanlink()');
        if (r === null) {
            return null;
        }

        const status: any = {};
        for (const line of r.split('\n')) {
            if (!line.includes('return ') || !line.includes('wanlink_')) {
                continue;
            }
            
            const key = line.split('(')[0].split('_')[1];
            const value = line.split(' ')[4].split(';')[0].replaceAll('\'', '');
            status[key] = Number(value) ? Number(value) : value;
        }

        return status as WanStatus;
    }

    /**
     * Checks if the WAN link is connected
     * @returns {boolean|null} Whether the WAN link is connected or null
     */
    async isWanOnline(): Promise<boolean | null> {
        const r = await this.get('wanlink()');
        if (r === null) {
            return null;
        }

        return r.includes('wanlink_status() { return 1;}');
    }

    // TODO: Add a custom type for this, I haven't yet because I'm lazy and it's large
    /**
     * Gets the routers current settings
     * @returns {Settings} The router settings
     */
    async getSettings() {
        const rawSettings = ['time_zone', 'time_zone_dst', 'time_zone_x', 'time_zone_dstoff', 'time_zone', 'ntp_server0', 'acs_dfs', 'productid', 'apps_sq', 'lan_hwaddr', 'lan_ipaddr', 'lan_proto', 'x_Setting', 'label_mac', 'lan_netmask', 'lan_gateway', 'http_enable', 'https_lanport', 'wl0_country_code', 'wl1_country_code'];
        const settings: any = {};
        for (const setting of rawSettings) {
            const r = await this.get(`nvram_get(${setting})`);
            if (r === null) {
                continue;
            }

            settings[setting] = JSON.parse(r)[setting];
        }

        return settings;
    }

    /**
     * Gets the IP address of the router
     * @returns The IP address of the router
     */
    async getLanIPAddress(): Promise<string | null> {
        const r = await this.get('nvram(lan_ipaddr)');
        if (r === null) {
            return null;
        }
        return JSON.parse(r).lan_ipaddr;

    }

    /**
     * Gets the netmask of the router
     * @returns {string|null} Router netmask or null
     */
    async getLanNetmask(): Promise<string | null> {
        const r = await this.get('nvram(lan_netmask)');
        if (r === null) {
            return null;
        }

        return JSON.parse(r).lan_netmask;
    }

    /**
     * Gets the ip address of the gateway for the LAN network
     * @returns {string|null} IP address of the gateway
     */
    async getLanGateway(): Promise<string | null> {
        const r = await this.get('nvram(lan_gateway)');
        if (r === null) {
            return null;
        }

        return JSON.parse(r).lan_gateway;
    }

    /**
     * Gets a list of DHCP leases
     * @returns {DHCPEntry[]|null} List of DHCP entries or null
     */
    async getDHCPList(): Promise<DHCPEntry[] | null> {
        const r = await this.get('dhcpLeaseMacList()');
        if (r === null) {
            return null;
        }

        const list: DHCPEntry[] = [];
        for (const entry of JSON.parse(r).dhcpLeaseMacList) {
            list.push({
                mac: entry[0],
                name: decodeURIComponent(entry[1])
            });
        }

        return list;
    }

    /**
     * Gets info on all currently online clients
     * @returns {ClientInfo[]|null} Client info on all online clients or null
     */
    async getOnlineClients(): Promise<ClientInfo[] | null> {
        const clients = await this.getClientsFullInfo();
        if (clients === null) {
            return null;
        }

        const list: ClientInfo[] = [];
        for (const client of clients.clientList) {
            if (!client.isOnline) {
                continue;
            }

            list.push(client);
        }

        return list;
    }

    /**
     * Gets info on a single client
     * @param clientMac MAC address of the requested client
     * @returns {ClientInfo|null} The client info or null
     */
    async getClientInfo(clientMac: string): Promise<ClientInfo|null> {
        const clients = await this.getClientsFullInfo();
        if (clients === null) {
            return null;
        }

        return clients.clientList.filter((x => x.mac === clientMac))[0] || null;
    }
};
