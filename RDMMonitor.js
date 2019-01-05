const Discord=require('discord.js');
const bot=new Discord.Client();
const request = require('request');
const config = require('./RDMMonitorConfig.json');

const warningImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/warned.png";
const okImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/ok.png";
const offlineImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/offline.png";
const instanceImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/instance.png";
const pokemonImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/pokemon.png";
const raidImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/raids.png";
const researchImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/research.png";

const warningTime = config.warningTime * 60000;
const offlineTime = config.offlineTime * 60000;

const okColor = 0x008000;
const warningColor = 0xFFFF00;
const offlineColor = 0xFF0000;

const DEVICE_QUERY = 'api/get_data?show_devices=true';
const INSTANCE_QUERY = 'api/get_data?show_instances=true'


var devices = {};
var instances = {};
var okDeviceMessage = "";
var warnDeviceMessage = "";
var offlineDeviceMessage = "";
var lastUpdatedMessage = "";
var channelsCleared = false;



bot.login(config.token);

bot.on('ready', () => {


    if(config.warningTime > 1000 || config.offlineTime > 1000)
    {
        console.log("WARNING warningTime and offlineTime should be in MINUTES not milliseconds");
    }
    
   
    ClearAllChannels().then(result => {
        UpdateStatusLoop().then(updated => {
            PostStatus();        
        });
    });
});

function UpdateStatusLoop()
{
    return new Promise(function(resolve) {
        UpdateDevices().then(updated => {
            UpdateInstances().then(updated => {
                setTimeout(UpdateStatusLoop, 5000);
                resolve(true);
            });
        });
    });
}

function UpdateInstances()
{    
    return new Promise(function(resolve) {
        request.get(config.url+INSTANCE_QUERY, {'auth': {'user':config.websiteLogin, 'password':config.websitePassword}, 'jar':true}, (err, res, body) => {
        
            var data;
            try {
                data = JSON.parse(body);
            } catch(err) {
                console.log("Could not retrieve data from website: "+body);
                console.log(err);
                resolve(false);
                return;
            }

            if(data.status=="error" || !data.data || !data)
            {
                console.log("Could not retrieve data from website: "+data.error);
                resolve(false);
                return;
            }
            
            if(!data.data.instances)
            {
                console.log("Failed to retrieve instance data from the website");
                resolve(false);
                return;
            }
            
            data.data.instances.forEach(function(instance) {
                if(!instances[instance.name])
                {
                    AddInstance(instance);
                }
                else
                {
                    UpdateInstance(instance);
                }
            });
            resolve(true);
        });
    });
}

function AddInstance(instance)
{
    if(config.ignoredInstances.indexOf(instance.name) != -1) { return }
    switch(instance.type)
    {
        case "Auto Quest":
        if(instance.status.bootstrapping)
        {
            let percent = instance.status.bootstrapping.current_count / instance.status.bootstrapping.total_count;
            percent *= 100;
            percent = PrecisionRound(percent, 2);

            instances[instance.name] = {
                'name':instance.name,
                'status':'Boostrapping: '+instance.status.bootstrapping.current_count+'/'+instance.status.bootstrapping.total_count+'('+percent+'%)',
                'type':'research'
            }
        }
        else
        {
            let percent = instance.status.quests.current_count_db / instance.status.quests.total_count;
            percent *= 100;
            percent = PrecisionRound(percent, 2);

            instances[instance.name] = {
                'name':instance.name,
                'status':instance.status.quests.current_count_db+'/'+instance.status.quests.total_count+'('+percent+'%)',
                'type':'research'
            }
        }
        break;
        case "Circle Raid":      
        if(instance.status)
        {
            instances[instance.name] = {
                'name':instance.name,
                'status':'Round Time: '+instance.status.round_time+'s',
                'type':'raid'
            }
        }
        else
        {
            instances[instance.name] = {
                'name':instance.name,
                'status': 'Round Time: N/A',
                'type':'raid'
            }
        }
        break;  
        case "Circle Pokemon":
        if(instance.status)
        {
            instances[instance.name] = {
                'name':instance.name,
                'status':'Round Time: '+instance.status.round_time+'s',
                'type':'pokemon'
            }
        }
        else
        {
            instances[instance.name] = {
                'name':instance.name,
                'status': 'Round Time: N/A',
                'type':'pokemon'
            }
        }
        break;
        case "Pokemon IV":
        instances[instance.name] = {
            'name':instance.name,
            'status':instance.status.iv_per_hour+' IV/H',
            'type':'pokemon'
        }
        break;
        case "Circle Smart Raid":
        instances[instance.name] = {
            'name':instance.name,
            'status':instance.status.scans_per_h+' Scans/H',
            'type':'raid'
        }
        break;

    }
}

function UpdateInstance(instance)
{
    if(!instances[instance.name])
    {
        AddInstance(instance);
    }
    else
    {
        switch(instance.type)
        {
            case "Auto Quest":
            if(instance.status.bootstrapping)
            {
                let percent = instance.status.bootstrapping.current_count / instance.status.bootstrapping.total_count;
                percent *= 100;
                percent = PrecisionRound(percent, 2);

                instances[instance.name].status = 'Boostrapping: '+instance.status.bootstrapping.current_count+'/'+instance.status.bootstrapping.total_count+'('+percent+'%)';
                
            }
            else
            {
                let percent = instance.status.quests.current_count_db / instance.status.quests.total_count;
                percent *= 100;
                percent = PrecisionRound(percent, 2);

                instances[instance.name].status = instance.status.quests.current_count_db+'/'+instance.status.quests.total_count+'('+percent+'%)';
                
            }
            break;
            case "Circle Raid":
            case "Circle Pokemon":
            if(instance.status)
            {
                instances[instance.name].status = 'Round Time: '+instance.status.round_time+'s';
                
            }
            else
            {
                instances[instance.name].status = 'Round Time: N/A';
                
            }
            break;
            case "Pokemon IV":
            instances[instance.name].status = instance.status.iv_per_hour+' IV/H';            
            break;
            case "Circle Smart Raid":
            instances[instance.name].status = instance.status.scans_per_h+' Scans/H';            
            break;

        }
    }
}

function UpdateDevices()
{
    return new Promise(function(resolve) {
        request.get(config.url+DEVICE_QUERY, {'auth': {'user':config.websiteLogin, 'password':config.websitePassword}, 'jar':true}, (err, res, body) => {
                    
            let data = JSON.parse(body);       

            if(data.status=="error" || !data.data)
            {
                console.log("Could not retrieve data from website: "+data.error);
                resolve(false);
                return;
            }

            if(!data.data.devices)
            {
                console.log("Failed to retrieve device data from the website");
                resolve(false);
                return;
            }
            
            data.data.devices.forEach(function(device) {
                if(!devices[device.uuid])
                {
                    AddDevice(device);
                }
                else
                {
                    UpdateDevice(device);
                }
            });

            resolve(true);

        });
    });
}

function AddDevice(device)
{
    if(config.ignoredDevices.indexOf(device.uuid) != -1) { return }
    devices[device.uuid] = {
        "name":device.uuid,
        "lastSeen": device.last_seen,
        "account": device.username,
        "instance": device.instance,
        "host": device.host,
        "alerted": false        
    };

    if(!devices[device.uuid].lastSeen) { devices[device.uuid].lastSeen = "Never"}
    if(!devices[device.uuid].account) { devices[device.uuid].account = "Unknown"}
    if(!devices[device.uuid].instance) {devices[device.uuid].instance = "Unassigned"}
    if(!devices[device.uuid].host) {devices[device.uuid].host = "Unknown"}
}

function UpdateDevice(device)
{
    if(!devices[device.uuid])
    {
        AddDevice(device);
    }
    else
    {
        devices[device.uuid].lastSeen = device.last_seen;
        devices[device.uuid].account = device.username;
        devices[device.uuid].instance = device.instance;
        devices[device.uuid].host = device.host;        
    }

    if(!devices[device.uuid].lastSeen) { devices[device.uuid].lastSeen = "Never"}
    if(!devices[device.uuid].account) { devices[device.uuid].account = "Unknown"}
    if(!devices[device.uuid].instance) {devices[device.uuid].instance = "Unassigned"}
    if(!devices[device.uuid].host) {devices[device.uuid].host = "Unknown"}
}

function PostStatus()
{       
    let posted = [];

    posted.push(PostDevices());
    posted.push(PostInstances());
    posted.push(PostGroupedDevices());
    SendOfflineDeviceDMs();
    
    Promise.all(posted).then(done => {        
        PostLastUpdated();
    });            
    
}

function PostDevices()
{
    return new Promise(function(resolve) {
        if(!config.postIndividualDevices)
        {            
            resolve(true);
        }
        else
        {              
            let posts = [];
            for(var deviceID in devices)
            {
                let device = devices[deviceID];
                if(device.message)
                {
                    posts.push(EditDevicePost(device));
                }
                else
                {
                    posts.push(PostDevice(device));
                }
            }
            
            Promise.all(posts).then(finished => {                
                PostDevices();   
                if(lastUpdatedMessage) { PostLastUpdated(); }
                resolve(true);
                return;
            });
            
        }
    });
}

function PostGroupedDevices()
{
    return new Promise(function(resolve) {
    
        if(config.postDeviceSummary)
        {  
            let now = new Date();
            now = now.getTime();

            let okDevices = [];
            let warnDevices = []; 
            let offlineDevices = [];

            for(var deviceName in devices)
            {
                let device = devices[deviceName];
                let lastSeen = new Date(0);
                lastSeen.setUTCSeconds(device.lastSeen);
                lastSeen = lastSeen.getTime();
                lastSeen = now - lastSeen;                
                if(lastSeen > offlineTime)
                {
                    offlineDevices.push(device.name);
                }
                else if(lastSeen > warningTime)
                {
                    warnDevices.push(device.name);
                }
                else
                {
                    okDevices.push(device.name);
                }
            }
            if(okDevices.length == 0) {okDevices.push("None")}
            if(warnDevices.length == 0) {warnDevices.push("None")}
            if(offlineDevices.length == 0) {offlineDevices.push("None")}

            

            PostDeviceGroup(okDevices, okColor, okImage, 'Working Devices', okDeviceMessage).then(posted => {
                okDeviceMessage = posted.id;
                PostDeviceGroup(warnDevices, warningColor, warningImage, 'Warning Devices', warnDeviceMessage).then(posted => {
                    warnDeviceMessage = posted.id;
                    PostDeviceGroup(offlineDevices, offlineColor, offlineImage, 'Offline Devices', offlineDeviceMessage).then(posted => {
                        offlineDeviceMessage = posted.id;
                        offlineDeviceList = offlineDevices;   
                        if(lastUpdatedMessage) { PostLastUpdated(); }
                        PostGroupedDevices();
                        resolve(true);
                        return;
                    });
                });
            });    
            
        }
        else
        {            
            resolve(true);
            return;
        }
        
    });
}

function SendOfflineDeviceDMs()
{

    let now = new Date();
    now = now.getTime();

    let offlineDevices = [];

    for(var deviceName in devices)
    {
        let device = devices[deviceName];
        let lastSeen = new Date(0);
        lastSeen.setUTCSeconds(device.lastSeen);
        lastSeen = lastSeen.getTime();
        lastSeen = now - lastSeen;                
        if(lastSeen > offlineTime)
        {
            offlineDevices.push(device.name);
        }
    }

    for(var i = 0; i < offlineDevices.length; i++)
    {
        if(!devices[offlineDevices[i]].alerted)
        {
            SendDMAlert(offlineDevices[i]);
            devices[offlineDevices[i]].alerted = true;
        }
    }

    for(var deviceName in devices)
    {
        if(devices[deviceName].alerted && offlineDevices.indexOf(deviceName) == -1)
        {
            devices[deviceName].alerted = false;
            SendDeviceOnlineAlert(deviceName);
        }
    }

    setTimeout(SendOfflineDeviceDMs, 60000);
    
}

function SendDMAlert(device)
{
    for(var i = 0; i < config.userAlerts.length; i++)
    {
        let user = bot.users.get(config.userAlerts[i]);
        if(!user)
        {
            console.log("Cannot find a user to DM with ID: "+config.userAlerts[i]);
        }
        else
        {
            user.send("Device: "+device+" is offline!").catch(error => {
                console.log("Failed to send a DM to user: "+user.id);
            });
        }
    }
}

function SendDeviceOnlineAlert(device)
{
    for(var i = 0; i < config.userAlerts.length; i++)
    {
        let user = bot.users.get(config.userAlerts[i]);
        if(!user)
        {
            console.log("Cannot find a user to DM with ID: "+config.userAlerts[i]);
        }
        else
        {
            user.send("Device: "+device+" has come back online").catch(error => {
                console.log("Failed to send a DM to user: "+user.id);
            });
        }
    }
}


function PostDeviceGroup(deviceList, color, image, title, messageID)
{

    return new Promise(function(resolve) {
        let channel = config.deviceSummaryChannel ? bot.channels.get(config.deviceSummaryChannel) : bot.channels.get(config.channel);

        let deviceString = GetDeviceString(deviceList);
        

        let embed = {
            'title':title,
            'color':color,
            'thumbnail': {'url':image},
            'description': deviceString
        }
        
    

        if(messageID)
        {
            channel.fetchMessage(messageID).then(message => {
                message.edit({embed: embed}).then(posted => {
                    resolve(posted);
                });
            });
        }
        else
        {
            channel.send({embed: embed}).then(posted => {            
            resolve(posted);
            });
        }
    });
}

function GetDeviceString(deviceList)
{
    
    let currentString = "";

    for(var i = 0; i < deviceList.length; i++)
    {
        if(currentString.length + deviceList[i].length + 2 > 2000)
        {
            return currentString + "and more...";
        }
        if(i == deviceList.length - 1)
        {
            currentString = currentString + deviceList[i];
        }
        else
        {
            currentString = currentString + deviceList[i] + ", ";
        }
    }

    
    return currentString;
}

function PostInstances()
{
    return new Promise(function(resolve) {
        if(!config.postInstanceStatus)
        {            
            resolve(true);
        }
        else
        {         
            let posts = [];
            for(var instanceName in instances)
            {
                let instance = instances[instanceName];
                if(instance.message)
                {
                    posts.push(EditInstancePost(instance));
                }
                else
                {
                    posts.push(PostInstance(instance));
                }
            }

            Promise.all(posts).then(finished => {
                PostInstances();
                if(lastUpdatedMessage) { PostLastUpdated(); }
                resolve(true);                 
                return;
            });           
        }
    });    
}


function PostLastUpdated()
{
    return new Promise(function(resolve) {
        let channel = config.deviceSummaryChannel ? bot.channels.get(config.deviceSummaryChannel) : bot.channels.get(config.channel);
        let now = new Date();
        let lastUpdated = "Last Updated at: **"+now.toLocaleString()+"**";

        if(lastUpdatedMessage)
        {
            channel.fetchMessage(lastUpdatedMessage).then(message => {
                message.edit(lastUpdated).then(edited => {
                    resolve(true);
                });

            });
        }
        else
        {
            channel.send(lastUpdated).then(message => {
                lastUpdatedMessage = message.id;
                resolve(true);
            });
        }        
    });
}

function PostInstance(instance)
{
    return new Promise(function(resolve) {
        let channel = config.instanceStatusChannel ? bot.channels.get(config.instanceStatusChannel) : bot.channels.get(config.channel);
        let message = BuildInstanceEmbed(instance);        
        channel.send({'embed': message}).then(message => {
            instance.message = message.id;
            resolve(true);
        });
    });
}

function EditInstancePost(instance)
{
    return new Promise(function(resolve) {
        let channel = config.instanceStatusChannel ? bot.channels.get(config.instanceStatusChannel) : bot.channels.get(config.channel);
        channel.fetchMessage(instance.message).then(message => {
            let embed = BuildInstanceEmbed(instance);
            message.edit({'embed': embed}).then(edited => {
                resolve(true);
            });
        });
    });
}

function EditDevicePost(device)
{
    return new Promise(function(resolve) {
        let channel = config.deviceStatusChannel ? bot.channels.get(config.deviceStatusChannel) : bot.channels.get(config.channel);
        channel.fetchMessage(device.message).then(message => {
            let embed = BuildDeviceEmbed(device);
            message.edit({'embed': embed}).then(edited => {
                resolve(true);
            });
        });
    });
}

function PostDevice(device)
{
    return new Promise(function(resolve) {
        let channel = config.deviceStatusChannel ? bot.channels.get(config.deviceStatusChannel) : bot.channels.get(config.channel);
        let message = BuildDeviceEmbed(device);
        channel.send({embed:message}).then(message => {
            device.message = message.id;
            resolve(true);
        });
    });
}

function BuildInstanceEmbed(instance)
{
    let deviceList = GetDeviceList(instance);

    let color = 0x0000FF;    
    
    let now = new Date();
    
    let image = instanceImage;

    switch(instance.type)
    {
        case 'research':
        image = researchImage;
        break;
        case 'pokemon':
        image = pokemonImage;
        break;
        case 'raid':
        image = raidImage;
        break;
        default:
        break;
    }

    let instanceDevices = "";
    if(deviceList.devices.length > 0)
    {
        instanceDevices = deviceList.devices.toString();
    }
    else
    {
        instanceDevices = "None";
    }

    let fields = [
        {'name':'Status', 'value':instance.status, 'inline':true},
        {'name':'Device Count: ', 'value':deviceList.count, 'inline':true},
        {'name':'Device List: ', 'value':instanceDevices, 'inline':true}
    ];
    let embed = {
        'title':instance.name,
        'color':color,
        'fields': fields,
        'thumbnail': {url: image},
        'footer': {'text':'Last Updated: '+now.toLocaleString() }

    }

    return embed;
}

function BuildDeviceEmbed(device)
{
    let fields = [];

    let color = okColor;
    let image = okImage;

    if(config.showLastSeen)
    {
        let now = new Date();
        now = now.getTime();
        let lastSeen = new Date(0);
        lastSeen.setUTCSeconds(device.lastSeen);
        fields.push({'name':'Last Seen: ', 'value': lastSeen.toLocaleString(), 'inline':true});
          
        let lastSeenDifference = now - lastSeen.getTime();
        if(lastSeenDifference > warningTime)
        {
            color = warningColor;
            image = warningImage;
        }
        if(lastSeenDifference > offlineTime)
        {
            color = offlineColor;
            image = offlineImage;
        }
    }
    if(config.showInstance)
    {
        fields.push({'name':'Instance', 'value':device.instance, 'inline':true});
    }
    if(config.showAccount)
    {        
        fields.push({'name':'Account', 'value':device.account, 'inline':true});
    }
    if(config.showHost)
    {
        fields.push({'name':'Host', 'value':device.host, 'inline':true});
    }

    let now = new Date();

    let embedMSG = {
        'title': device.name,
        'color': color,
        'thumbnail': {url: image},
        'fields':fields,
        'footer': {'text':'Last Updated: '+now.toLocaleString() }
    };

    return embedMSG;
}

function ClearAllChannels()
{
    
    return new Promise(function(resolve) {
        if(!config.clearMessagesOnStartup || channelsCleared) { resolve(true); return; }

        let cleared = [];

        cleared.push(ClearMessages(config.deviceStatusChannel));
        cleared.push(ClearMessages(config.instanceStatusChannel));
        cleared.push(ClearMessages(config.deviceSummaryChannel));
        cleared.push(ClearMessages(config.channel));

        Promise.all(cleared).then(done => {
            channelsCleared = true;
            resolve(true);
        });

    });
}

function ClearMessages(channelID)
{    
    return new Promise(function(resolve) {
    
        if(channelsCleared) { resolve(true); return; }
        let channel = bot.channels.get(channelID);
        if(!channel) { resolve(false); console.log("Could not find a channel with ID: "+channelID); return;}
        channel.fetchMessages({limit:99}).then(messages => {                
            channel.bulkDelete(messages).then(deleted => {
                if(messages.size > 0)
                {
                    ClearMessages(channelID).then(result => {
                        resolve(true);
                        return;
                    });
                    
                }
                else
                {
                    resolve(true);
                    return;
                }
            }).catch(console.error, resolve(false));
        });
    });
}

function GetDeviceList(instance)
{
    let count = 0;
    let deviceList = [];

    for(var deviceID in devices)
    {
        let device = devices[deviceID];
        if(device.instance===instance.name) { count++; deviceList.push(deviceID); }
    }

    return {'count':count, 'devices':deviceList };
}

function PrecisionRound(number, precision) 
{
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

bot.on('error', function(err)  {
    err = JSON.stringify(err);
    console.log('An error occured: ${err}');
});

process.on('uncaughtException', function(err) {
    err = JSON.stringify(err);
    console.log('Uncaught exception: ${err}');
});