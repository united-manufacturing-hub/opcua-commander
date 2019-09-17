/* eslint no-console: off , no-process-exit: off*/

require("colors");
const _ = require("underscore");
const assert = require("assert");
const util = require("util");
const blessed = require("blessed");
const chalk = require("chalk");
const path = require("path");
const Tree = require("./widget_tree").Tree;

const opcua = require("node-opcua-client");
const NodeClass = opcua.NodeClass;
const { StatusCodes } = require("node-opcua-status-code");
const attributeIdtoString = _.invert(opcua.AttributeIds);
const DataTypeIdsToString = _.invert(opcua.DataTypeIds);
//xx const NodeClassToString = _.invert(opcua.NodeClass);
const truncate = require("cli-truncate");
const updateNotifier = require("update-notifier");
const pkg = require('./package.json');


const attributeKeys = Object.keys(opcua.AttributeIds).filter((x) => x !== "INVALID" && x[0].match(/[a-zA-Z]/));

const argv = require("yargs")
    .wrap(132)

    .demand("endpoint")
    .string("endpoint")
    .describe("endpoint", "the end point to connect to ")

    .string("securityMode")
    .describe("securityMode", "the security mode")

    .string("securityPolicy")
    .describe("securityPolicy", "the policy mode")

    .string("userName")
    .describe("userName", "specify the user name of a UserNameIdentityToken ")

    .string("password")
    .describe("password", "specify the password of a UserNameIdentityToken")

    .string("node")
    .describe("node", "the nodeId of the value to monitor")

    .string("history")
    .describe("history", "make an historical read")

    .string("userCertificate")
    .describe("userCertificate", "X509 user certificate (PEM format)")

    .string("userCertificatePrivateKey")
    .describe("userCertificatePrivateKey", "X509 private key associated with the user certificate")


    .boolean("verbose")
    .describe("verbose", "display extra information")

    .alias("e", "endpoint")
    .alias("s", "securityMode")
    .alias("P", "securityPolicy")
    .alias("u", "userName")
    .alias("p", "password")
    .alias("n", "node")
    .alias("t", "timeout")
    .alias("v", "verbose")
    .alias("c", "userCertificate")
    .alias("x", "userCertificatePrivateKey")

    .example("opcua-commander  --endpoint opc.tcp://localhost:49230 -P=Basic256 -s=Sign")
    .example("opcua-commander  -e opc.tcp://localhost:49230 -P=Basic256 -s=Sign -u JoeDoe -p P@338@rd ")
    .example("opcua-commander  --endpoint opc.tcp://localhost:49230  -n=\"ns=0;i=2258\"")

    .argv;


const securityMode = opcua.MessageSecurityMode[argv.securityMode || "None"];
if (!securityMode) {
    throw new Error("Invalid Security mode , should be " + opcua.MessageSecurityMode.enums.join(" "));
}

const securityPolicy = opcua.SecurityPolicy[argv.securityPolicy || "None"];
if (!securityPolicy) {
    throw new Error("Invalid securityPolicy , should be " + opcua.SecurityPolicy.enums.join(" "));
}


const endpointUrl = argv.endpoint || "opc.tcp://localhost:26543";
const yargs = require("yargs");
if (!endpointUrl) {
    yargs.showHelp();
    updateNotifier({pkg}).notify();
    process.exit(0);
}


const certificateFile = path.join(__dirname, "certificates", "client_certificate.pem");
const privateKeyFile = path.join(__dirname, "certificates", "PKI/own/private/private_key.pem");



const data = {
    reconnectionCount: 0,
    tokenRenewalCount: 0,
    receivedBytes: 0,
    sentBytes: 0,
    sentChunks: 0,
    receivedChunks: 0,
    backoffCount: 0,
    transactionCount: 0,
};

const client = opcua.OPCUAClient.create({

    endpoint_must_exist: false,

    securityMode: securityMode,
    securityPolicy: securityPolicy,
    //xx serverCertificate: serverCertificate,
    defaultSecureTokenLifetime: 40000,
    certificateFile: certificateFile,
    privateKeyFile: privateKeyFile,

    keepSessionAlive: true

});

client.on("send_request", function () {
    data.transactionCount++;
});

client.on("send_chunk", function (chunk) {
    data.sentBytes += chunk.length;
    data.sentChunks++;
});

client.on("receive_chunk", function (chunk) {
    data.receivedBytes += chunk.length;
    data.receivedChunks++;
});

client.on("backoff", function (number, delay) {
    data.backoffCount += 1;
    console.log(chalk.yellow(`backoff  attempt #${number} retrying in ${delay/1000.0} seconds`));
});

client.on("start_reconnection", function () {
    console.log(chalk.red(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting reconnection !!!!!!!!!!!!!!!!!!! " + endpointUrl));
});

client.on("connection_reestablished", function () {
    console.log(chalk.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!! " + endpointUrl));
    data.reconnectionCount++;
});

// monitoring des lifetimes
client.on("lifetime_75", function (token) {
    if (argv.verbose) {
        console.log(chalk.red("received lifetime_75 on " + endpointUrl));
    }
});

client.on("security_token_renewed", function () {
    data.tokenRenewalCount += 1;
    if (argv.verbose) {
        console.log(chalk.green(" security_token_renewed on " + endpointUrl));
    }
});


let g_session = null;

let populateTree = function () {
    //
};

let g_subscription = null;

function create_subscription() {

    assert(g_session);
    const parameters = {
        requestedPublishingInterval: 500,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 12,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
    };
    g_session.createSubscription2(
        parameters,
        (err, subscription) => {
            if (err) {
                console.log("Cannot create subscription", err.message);
                return;
            }
            g_subscription = subscription;
            console.log("subscription created");
        });


}


function doDonnect(callback) {
    console.log("connecting to ....", endpointUrl);
    client.connect(endpointUrl, function (err) {
        if (err) {
            console.log(" Cannot connect", err.toString());
            console.log(chalk.red("  exiting"));
            updateNotifier({pkg}).notify();
            setTimeout(function () {
                return process.exit(-1);
            }, 5000);
            return;
        }
        console.log("connected to ....", endpointUrl);
        let userIdentity = null; // anonymous
        if (argv.userName && argv.password) {

            userIdentity = {
                userName: argv.userName,
                password: argv.password
            };

        } else if (argv.userCertificate && argv.userCertificatePrivateKey) {

            userIdentity = {
                userName: argv.userName,
                password: argv.password
            };

        }
        client.createSession(userIdentity, function (err, session) {
            if (!err) {
                g_session = session;

                g_session.on("session_closed", () => {
                    console.log(" Warning => Session closed");
                });
                g_session.on("keepalive", () => {
                    console.log("session keepalive");
                });
                g_session.on("keepalive_failure", () => {
                    console.log("session keepalive failure");
                });

                create_subscription();
                populateTree();
            } else {
                console.log(" Cannot create session ", err.toString());
                console.log(chalk.red("  exiting"));
                setTimeout(function () {
                    return process.exit(-1);
                }, 5000);
            }

            //xx callback(err);
        });
    });


}

/**
 *
 * @param callback
 * @param callback.err {Error}
 */
function disconnect(callback) {
    if (!g_session) {
        client.disconnect(function (err) {
            callback(err);
        });
    } else {
        g_session.close(function () {
            client.disconnect(function (err) {
                callback(err);
            });
        });
    }
}

// Create a screen object.
const screen = blessed.screen({
    smartCSR: true,
    autoPadding: false,
    fullUnicode: true
});
screen.title = "OPCUA CLI-Client";


// create the main area
const area1 = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: "90%-10",
});
const area2 = blessed.box({
    top: "90%-9",
    left: 0,
    width: "100%",
    height: "shrink",

});
const w2 = "40%";
const scrollbar = {
    ch: " ",
    track: {
        bg: "cyan"
    },
    style: {
        inverse: true
    }
};
const style = {

    focus: {
        border: {
            fg: "yellow"
        },
        bold: false

    },
    item: {
        hover: {
            bg: "blue"
        }
    },
    selected: {
        bg: "blue",
        bold: true
    }
};
screen.append(area1);
screen.append(area2);

let monitoredItemsList = null;

function install_monitoredItemsWindow() {

    monitoredItemsList = blessed.listtable({
        parent: area1,
        tags: true,
        top: "50%",
        left: w2 + "+1",
        width: "60%-1",
        height: "50%",
        keys: true,
        label: " Monitored Items ",
        border: "line",
        scrollbar: scrollbar,
        noCellBorders: true,
        style: _.clone(style),
        align: "left"
    });

    area1.append(monitoredItemsList);

    //xx monitoredItemsList.setRows([["1","a"]])

}

const monitoredItemsListData = [];

function monitor_item(treeItem) {

    const node = treeItem.node;

    g_subscription.monitor({
        nodeId: node.nodeId,
        attributeId: opcua.AttributeIds.Value
        //, dataEncoding: { namespaceIndex: 0, name:null }
    }, {
        samplingInterval: 1000,
        discardOldest: true,
        queueSize: 100
    }, 
    opcua.TimestampsToReturn.Both,
    function (err, monitoredItem) {

        if (err) {
            console.log("cannot create monitored item", err.message);
            return;
        }

        node.monitoredItem = monitoredItem;

        const monitoredItemData = [node.browseName, node.nodeId.toString(), "Q"];
        monitoredItemsListData.push(monitoredItemData);
        monitoredItemsList.setRows(monitoredItemsListData);

        monitoredItem.on("changed", function (dataValue) {

            console.log(" value ", node.browseName, node.nodeId.toString(), " changed to ", chalk.green(dataValue.value.toString()));
            if (dataValue.value.value.toFixed) {
                node.valueAsString = w(dataValue.value.value.toFixed(3), 16);
            } else {
                node.valueAsString = w(dataValue.value.value.toString(), 16);
            }

            monitoredItemData[2] = node.valueAsString;
            monitoredItemsList.setRows(monitoredItemsListData);
            monitoredItemsList.render();
        });
    });

}

function unmonitor_item(treeItem) {

    const node = treeItem.node;

    // terminate subscription
    node.monitoredItem.terminate(function () {

        let index = -1;
        monitoredItemsListData.forEach(function (entry, i) {
            if (entry[1] == node.nodeId.toString()) {
                index = i;
            }
        });
        if (index > -1) {
            monitoredItemsListData.splice(index, 1);
        }

        node.monitoredItem = null;

        if (monitoredItemsListData.length > 0) {
            monitoredItemsList.setRows(monitoredItemsListData);
        } else {
            // when using setRows with empty array, the view does not update.
            // setting an empty row.
            const empty = [
                [" "]
            ];
            monitoredItemsList.setRows(empty);
        }

        monitoredItemsList.render();

    });


}

/**
 * @param options.class
 * @param options.nodeId
 * @param options.arrow
 * @constructor
 */
function TreeItem(options) {
    const self = this;
    Object.keys(options).forEach(function (k) {
        self[k] = options[k];
    });
}

TreeItem.prototype.__defineGetter__("name", function () {
    return this.arrow;
});

TreeItem.prototype.__defineGetter__("name", function () {
    let str = this.arrow + " " + this.browseName;
    if (this.class === opcua.NodeClass.Variable) {
        str += " = " + this.valueAsString;
    }
    return str;
});


function expand_opcua_node(node, callback) {

    if (!g_session) {
        return callback(new Error("No Connection"));
    }

    const children = [];

    const b = [{
            nodeId: node.nodeId,
            referenceTypeId: "Organizes",
            includeSubtypes: true,
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3f

        },
        {
            nodeId: node.nodeId,
            referenceTypeId: "Aggregates",
            includeSubtypes: true,
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3f

        },
        {
            nodeId: node.nodeId,
            referenceTypeId: "HasSubtype",
            includeSubtypes: true,
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3f
        },

    ];

    g_session.browse(b, function (err, results) {

        if (!err) {

            let result = results[0];

            for (let i = 0; i < result.references.length; i++) {
                const ref = result.references[i];
                children.push(new TreeItem({
                    arrow: "◊-o-> ",
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    class: ref.class,
                    children: expand_opcua_node
                }));
            }

            result = results[1];
            for (let i = 0; i < result.references.length; i++) {
                const ref = result.references[i];
                children.push(new TreeItem({
                    arrow: "+--> ",
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    class: ref.class,
                    children: expand_opcua_node
                }));
            }
            result = results[2];
            for (let i = 0; i < result.references.length; i++) {
                const ref = result.references[i];
                children.push(new TreeItem({
                    arrow: "§--|> ",
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    class: ref.class,
                    children: expand_opcua_node
                }));
            }

        }
        callback(err, children);
    });
}


let attributeList = null;

function w(s, l, c) {
    c = c || " ";
    const filling = Array(25).join(c[0]);
    return (s + filling).substr(0, l);
}

function makeItems(arr) {
    return arr.map(function (a) {
        return w(a[0], 25, ".") + ": " + w(a[1], attributeList.width - 28);
    });
}

function install_attributeList() {


    attributeList = blessed.list({
        parent: area1,
        label: " {bold}{cyan-fg}Attribute List{/cyan-fg}{/bold} ",
        top: 0,
        tags: true,
        left: w2 + "+1",
        width: "60%-1",
        height: "50%",
        border: "line",
        noCellBorders: true,
        scrollbar: scrollbar,
        style: _.clone(style),
        align: "left",
        keys: true
    });
    area1.append(attributeList);

    attributeList.setItems(makeItems([]));
}

function dataValueToString(dataValue) {
    if (!dataValue.value || dataValue.value.value === null) {
        return "<???> : " + dataValue.statusCode.toString();
    }
    switch (dataValue.value.arrayType) {
        case opcua.VariantArrayType.Scalar:
            return dataValue.toString();
        case opcua.VariantArrayType.Array:
            return dataValue.toString();
        default:
            return "";
    }
}

function toString1(attribute, dataValue) {

    if (!dataValue || !dataValue.value || !dataValue.value.hasOwnProperty("value")) {
        return "<null>";
    }
    switch (attribute) {
        case opcua.AttributeIds.DataType:
            return DataTypeIdsToString[dataValue.value.value.value] + " (" + dataValue.value.value.toString() + ")";
        case opcua.AttributeIds.NodeClass:
            return NodeClass[dataValue.value.value] + " (" + dataValue.value.value + ")";
        case opcua.AttributeIds.IsAbstract:
        case opcua.AttributeIds.Historizing:
        case opcua.AttributeIds.EventNotifier:
            return dataValue.value.value ? "true" : "false"
        case opcua.AttributeIds.WriteMask:
        case opcua.AttributeIds.UserWriteMask:
            return " (" + dataValue.value.value + ")";
        case opcua.AttributeIds.NodeId:
        case opcua.AttributeIds.BrowseName:
        case opcua.AttributeIds.DisplayName:
        case opcua.AttributeIds.Description:
        case opcua.AttributeIds.ValueRank:
        case opcua.AttributeIds.ArrayDimensions:
        case opcua.AttributeIds.Executable:
        case opcua.AttributeIds.UserExecutable:
        case opcua.AttributeIds.MinimumSamplingInterval:
            if (!dataValue.value.value) {
                return "null";
            }
            return dataValue.value.value.toString();
        case opcua.AttributeIds.UserAccessLevel:
        case opcua.AttributeIds.AccessLevel:
            if (!dataValue.value.value) {
                return "null";
            }
            return opcua.accessLevelFlagToString(dataValue.value.value) + " (" + dataValue.value.value + ")";
        default:
            return dataValueToString(dataValue);
    }
}


function fill_attributesRegion(node) {

    const attr = [];

    function append_text(prefix, s, attr) {
        const a = s.split("\n");
        if (a.length === 1) {
            attr.push([prefix, s]);
        } else {
            attr.push([prefix, a[0]]);
            for (let j = 1; j < a.length; j++) {
                attr.push(["   |    ", a[j]]);
            }
        }

    }

    const nodesToRead = attributeKeys.map((attr) => ({
        nodeId: node.nodeId,
        attributeId: opcua.AttributeIds[attr]
    }));


    g_session.read(nodesToRead, function (err, dataValues) {
        if (err) {
            console.log("#readAllAttributes returned ", err.message);
            return;
        }

        for (let i = 0; i < nodesToRead.length; i++) {

            const nodeToRead = nodesToRead[i];
            const dataValue = dataValues[i];

            if (dataValue.statusCode !== StatusCodes.Good) {
                continue;
            }
            const s = toString1(nodeToRead.attributeId, dataValue);
            append_text(attributeIdtoString[nodeToRead.attributeId], s, attr);
        }
        attributeList.setItems(makeItems(attr));
        attributeList.screen.render();
    });
}

let refreshTimer = 0;
let tree;
let alarmBox;
let clientAlarms;

function ellipsys(a) {
    if(!a) { return ""; }
    return a;
    return truncate(a,20,{ position: "middle"});
}
function n(a) {
    if (a===null || a === undefined) {
        return "";
    }
    return a.toString();
}
function f(flag) {
    return flag ? "X" : "_";
}
async function updateAlarmBox() {

    clientAlarms.purgeUnusedAlarms();
    const data = [alarmBox.$headers]
    for(const alarm of clientAlarms.alarms()) {

        const fields = alarm.fields;
        const isEnabled = fields.enabledState.id.value;
        data.push([
            alarm.eventType.toString(),
            alarm.conditionId.toString(),
            // fields.branchId.value.toString(),
            // ellipsys(alarm.eventId.toString("hex")),
            isEnabled ? ellipsys(fields.message.value.text) : "-",
            isEnabled ? fields.severity.value + ' (' + fields.lastSeverity.value + ')' : "-",
            (f(fields.enabledState.id.value)) +
            (isEnabled ? f(fields.activeState.id.value): "-") +
            (isEnabled ? f(fields.ackedState.id.value): "-" )+
            (isEnabled ? f(fields.confirmedState.id.value): "-"),
           // (isEnabled ? f(fields.retain.value) : "-"),
            (isEnabled ? ellipsys(fields.comment.value.text) : "-"),
        ])

    }
    alarmBox.setRows(data);
    screen.render();
}
function install_alarm_windows() {
    if (alarmBox) {
        alarmBox.show();
        return;
    }
    
    
    alarmBox = blessed.listtable({
        parent: area1,
        fg: "green",
        // label: "{bold}{cyan-fg}Alarms - Conditions {/cyan-fg}{/bold} ",
        label: "Alarms - Conditions",
        top: "top+6",
        left: "left+2",
        width: "100%-4",
        height: "100%-6",
        keys: true,
        border: "line",
        scrollbar: scrollbar,
        noCellBorders: false,
        style: _.clone(style)
    });
    alarmBox.fg = "green";

    alarmBox.$headers =  ["EventType", "ConditionId", 
    // "BranchId", 
    //"EventId",
    "Message", 
    "Severity", 
    "E!AC",
    //"Enabled?", "Active?",  "Acked?", "Confirmed?", "Retain",
    "Comment", 
    ];
    
    const data = [ alarmBox.$headers ];
    
    alarmBox.setData(data);
    
    async function alarmStuff() {
        assert(g_session);
        clientAlarms = await opcua.installAlarmMonitoring(g_session);
        clientAlarms.on("alarmChanged", updateAlarmBox);
    }
    alarmStuff();
    alarmBox.focus();

}

function hide_alarm_windows() {
    alarmBox.hide();
}

function install_address_space_explorer() {

    tree = new Tree({
        parent: area1,
        tags: true,
        fg: "green",
        //Xx keys: true,
        label: " {bold}{cyan-fg}Address Space{/cyan-fg}{/bold} ",
        top: "top",
        left: "left",
        width: "40%",
        height: "100%",
        keys: true,
        vi: true,
        mouse: true,
        border: "line",
        style: _.clone(style)

    });

    //allow control the table with the keyboard
    tree.on("select", function (treeItem) {
        if (treeItem) {
            fill_attributesRegion(treeItem.node);
        }
    });
    tree.on("keypress", function (ch, key) {
        if (key.name === "up" || key.name === "down") {
            if (refreshTimer) {
                return;
            }
            const self = this;
            refreshTimer = setTimeout(function () {
                const treeItem = self.items[self.selected];
                if (treeItem && treeItem.node) {
                    fill_attributesRegion(treeItem.node);
                }
                refreshTimer = 0;
            }, 100);
        }

    });

    area1.append(tree);


    populateTree = function () {
        tree.setData({
            name: "RootFolder",
            nodeId: opcua.resolveNodeId("RootFolder"),
            children: expand_opcua_node
        });
    };

    tree.focus();
}


function install_logWindow() {

    const logWindow = blessed.list({

        parent: area2,
        tags: true,
        label: " {bold}{cyan-fg}Info{/cyan-fg}{/bold} ",
        top: "top",
        left: "left",
        width: "100%",
        height: "100%-4",
        keys: true,
        border: "line",
        scrollable: true,
        scrollbar: {
            ch: " ",
            track: {
                bg: "cyan"
            },
            style: {
                inverse: true
            }
        },
        style: _.clone(style)
    });

    let lines;
    const format = util.format;

    console.log = function () {

        const str = format.apply(null, arguments);
        lines = str.split("\n");
        lines.forEach(function (str) {
            logWindow.addItem(str);
        });
        logWindow.select(logWindow.items.length - 1);
    };

    area2.append(logWindow);

    const menuBar = blessed.listbar({
        parent: area2,
        top: "100%-2",
        left: "left",
        width: "100%",
        height: 2,
        keys: true,
        style: {
            prefix: {
                fg: "white"
            }
        },
        //xx label: " {bold}{cyan-fg}Info{/cyan-fg}{/bold}",
        //xx border: "line",
        bg: "cyan"
    });


    area2.append(menuBar);
    menuBar.setItems({
        "Monitor": {
            //xx prefix: "M",
            keys: ["m"],
            callback: function () {
                const treeItem = tree.items[tree.selected];
                if (treeItem.node.monitoredItem) {
                    console.log(" Already monitoring ", treeItem.node.nodeId.toString());
                    return;
                }
                monitor_item(treeItem);
            }
        },
        "Exit": {
            keys: ["q"], //["C-c", "escape"],
            callback: function () {
                console.log(chalk.red(" disconnecting .... "));
                disconnect(function () {
                    console.log(chalk.green(" disconnected .... "));
                    setTimeout(function () {
                        return process.exit(0);
                    }, 1000);
                });
            }
        },
        //xx "Next": {
        //xx     keys: ["tab"],
        //xx     callback: function () {
        //xx        console.log("next tab (use t/i/l instead)");
        //xx    }
        //xx },

        // screen.key(["l"], function (ch, key) {
        "Tree": {
            keys: ["t"],
            callback: function () {
                tree.focus();
            }
        },
        "Attributes": {
            keys: ["l"],
            callback: function () {
                console.log("setting focus to list");
                attributeList.focus();
            }
        },
        "Info": {
            keys: ["i"],
            callback: function () {
                console.log("setting focus to info");
                logWindow.focus();
            }
        },
        "Clear": {
            keys: ["c"],
            callback: function () {
                logWindow.clearItems();
                logWindow.screen.render();
            }
        },
        "Unmonitor": {
            keys: ["u"],
            callback: function () {
                const treeItem = tree.items[tree.selected];
                if (!treeItem.node.monitoredItem) {
                    console.log(treeItem.node.nodeId.toString(), " was not being monitored");
                    return;
                }
                unmonitor_item(treeItem);
            }
        },
        "Stat": {
            keys: ["s"],
            callback: function () {
                console.log("----------------------------------------------------------------------------");
                console.log(chalk.green("     transaction count : ", chalk.yellow(data.transactionCount)));
                console.log(chalk.green("            sent bytes : ", chalk.yellow(data.sentBytes)));
                console.log(chalk.green("        received bytes : ", chalk.yellow(data.receivedBytes)));
                console.log(chalk.green("   token renewal count : ", chalk.yellow(data.tokenRenewalCount)));
                console.log(chalk.green("    reconnection count : ", chalk.yellow(data.reconnectionCount)));

            }
        },
        "Alarm": {
            keys:["a"],
            callback: function() {
                if (alarmBox && alarmBox.visible) {
                    hide_alarm_windows();    
                } else {
                    install_alarm_windows();
                    alarmBox.show();    
                }
                screen.render();
            }   
        }
    });
}


install_address_space_explorer();
//xx install_graphWindow();
install_attributeList();
install_monitoredItemsWindow();

install_logWindow();


// Render the screen.
screen.render();
const version = require("./package.json").version;

console.log(chalk.green(" Welcome to Node-OPCUA Commander ") + version);
console.log(chalk.cyan("   endpoint url   = "), endpointUrl.toString());
console.log(chalk.cyan("   securityMode   = "), securityMode.toString());
console.log(chalk.cyan("   securityPolicy = "), securityPolicy.toString());

doDonnect(function () {

});