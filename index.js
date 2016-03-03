require("colors");
var _ = require("underscore");
var assert = require("assert");

var blessed = require('blessed');
var contrib = require("blessed-contrib");

var widget_tree = require("./widget_tree");
var opcua = require("node-opcua");


var NodeClass = require("node-opcua/lib/datamodel/nodeclass").NodeClass;
opcua.NodeClass = NodeClass;
var attributeIdtoString = _.invert(opcua.AttributeIds);
var DataTypeIdsToString = _.invert(opcua.DataTypeIds);
var NodeClassToString = _.invert(opcua.NodeClass);



var client = new opcua.OPCUAClient();

var endpoint = "opc.tcp://localhost:26543";
var g_session = null;

var populateTree = function(){};

var g_subscription = null;
function create_subscription() {

    assert(g_session);
    var parameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount:      1000,
        requestedMaxKeepAliveCount:  12,
        maxNotificationsPerPublish:  100,
        publishingEnabled: true,
        priority: 10
    };
    g_subscription = new opcua.ClientSubscription(g_session, parameters);

}
client.connect(endpoint,function() {

    client.createSession(function (err, session) {
        if (!err) {
            g_session = session;
            create_subscription();
            populateTree();
        } else {
            console.log(" Cannot create session ",err.toString());
            process.exit(-1);
        }

        //xx callback(err);
    });
});

function disconnect() {
    g_session.close(function() {
        client.disconnect(function(err) {

        });
    });
}



var monitoredItemsListData = [];

function monitor_item(treeItem) {

    var node = treeItem.node;


  var monitoredItem  = g_subscription.monitor({
            nodeId: node.nodeId,
            attributeId: opcua.AttributeIds.Value
            //, dataEncoding: { namespaceIndex: 0, name:null }
        },
        {
            samplingInterval: 1000,
            discardOldest: true,
            queueSize: 100
        });
    // subscription.on("item_added",function(monitoredItem){
    //xx monitoredItem.on("initialized",function(){ });
    //xx monitoredItem.on("terminated",function(value){ });


    node.monitoredItem = monitoredItem;

    var browseName = treeItem.browseName || node.nodeId.toString();


    var monitoredItemData = [node.browseName,node.nodeId.toString(),'Q'];
    monitoredItemsListData.push(monitoredItemData);
    monitoredItemsList.setRows(monitoredItemsListData);
    if (false) {
        var series1 = {
            title: browseName,
            x: [],
            y: []
        };
        line.setData(series1);
    }


    function w(s,l) {
        return (s+"                      ").substr(0,l);
    }
    monitoredItem.on("changed",function(dataValue){

        console.log(" value ",node.browseName,node.nodeId.toString(), " changed to ",dataValue.value.toString().green)
        if (dataValue.value.value.toPrecision) {
            node.valueAsString = w(dataValue.value.value.toPrecision(3),16);
        } else {
            node.valueAsString = w(dataValue.value.value.toString(),16);
        }

        //xx series1.title =  browseName+ " = " + dataValue.value.toString();
        //xx series1.x.push(series1.x.length+1);
        //xx series1.y.push(dataValue.value.value);
        //xxsqline.setData(series1);
        monitoredItemData[2] = node.valueAsString;
        monitoredItemsList.setRows(monitoredItemsListData);
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
    var self = this;
    Object.keys(options).forEach(function(k){self[k] = options[k];});
}
TreeItem.prototype.__defineGetter__("name",function() {
    return this.arrow
});
TreeItem.prototype.__defineGetter__("name",function() {
    var str =  this.arrow + " " + this.browseName;
    if (this.class === opcua.NodeClass.Variable) {
        str += " = " + this.valueAsString;
    }
    return str;
});


function expand_opcua_node(node, callback) {

    if (!g_session) {
        return callback(new Error("No Connection"));
    }
    //xx console.log("expand_opcua_node = ",node.nodeId.toString());
    var children = [];

    var b =  [
        {
            nodeId: node.nodeId,
            referenceTypeId: "Organizes",
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            resultMask : 0x3f

        },
        {
            nodeId: node.nodeId,
            referenceTypeId: "HasProperty",
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            resultMask : 0x3f

        },
        {
            nodeId: node.nodeId,
            referenceTypeId: "HasComponent",
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            resultMask : 0x3f

        }
    ];

    g_session.browse(b,function(err,results) {

        if(!err) {

            var result = results[0];
            var i;
            for(i=0;i<result.references.length;i++) {
                var ref = result.references[i];
                children.push(new TreeItem({
                    arrow: "◊-o-> ",
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    class: ref.class,
                    children: expand_opcua_node
                }))
            }

            result = results[1];
            for(i=0;i<result.references.length;i++) {
                var ref = result.references[i];
                children.push(new TreeItem({
                    arrow: "╙p-> ",
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    class: ref.class,
                    children: expand_opcua_node
                }));
            }
            result = results[2];
            for(i=0;i<result.references.length;i++) {
                var ref = result.references[i];
                children.push(new TreeItem({
                    arrow: "╙c-> ",
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    class: ref.class,
                    children: expand_opcua_node
                }));
            }
        }
        callback(err,children);
    });
}


// Create a screen object.
var screen = blessed.screen({
    smartCSR: true,
    "autoPadding": false,
    "fullUnicode": true
});

screen.title = 'OPCUA CLI-Client';


var scrollbar={
    ch: ' ',
    track: {
        bg: 'cyan'
    },
    style: {
        inverse: true
    }
};
var style = {

    focus: {
        border: {
            bg: 'yellow'
        },
        bold: false

    },
    item: {
        hover: {
            bg: 'blue'
        }
    },
    selected: {
        bg: 'blue',
            bold: true
    }
};
var w1 = 'left';
var w2 = '40%';
var w3 = '70%';

var attributeList = blessed.listtable({
    parent: screen,
    label: ' {bold}{cyan-fg}Attribute List{/cyan-fg}{/bold}',
    tags: true,
    //xx draggable: true,
    top: "top+1",
    left: w2+"-1",
    width: '60%-1',
    height: '60%-10',
    border: 'line',
    scrollbar: scrollbar,
    style: _.clone(style),
    align:"left"
});

screen.append(attributeList);

attributeList.setRows(
    [
    ]);



function d(dataValue) {
    //xconsole.log("dataValue =",dataValue.toString())
    if (!dataValue.value) {
        return "<???>";
    }
    return dataValue.value.value.toString()
}

function toString1(attribute,dataValue) {

    switch(attribute) {
        case opcua.AttributeIds.DataType:
            //xx console.log("dataValue.value.value.value=",dataValue.value.value.toString());
            return DataTypeIdsToString[dataValue.value.value.value] + " ("+ dataValue.value.value.toString() + ")";
        case opcua.AttributeIds.NodeClass:
            return NodeClass.get(dataValue.value.value).key + " (" + dataValue.value.value + ")";
        case opcua.AttributeIds.WriteMask:
        case opcua.AttributeIds.UserWriteMask:
            return  " (" + dataValue.value.value + ")";
        case opcua.AttributeIds.UserAccessLevel:
        case opcua.AttributeIds.AccessLevel:
            return  opcua.AccessLevelFlag.get(dataValue.value.value).key + " (" + dataValue.value.value + ")";
        default:
            return d(dataValue);
    }
}



function fill_attributesRegion(node) {

    console.log(" Reading nodeId ",node.nodeId);
    var attr = [];
    g_session.readAllAttributes(node.nodeId,function(err,nodesToRead,dataValues) {
        if (!err) {

            var i=0;
            for (i=0;i<nodesToRead.length;i++) {

                var nodeToRead = nodesToRead[i];
                var dataValue = dataValues[i];
                if (dataValue.statusCode !== opcua.StatusCodes.Good) {
                    continue;
                }
                attr.push([
                    attributeIdtoString[nodeToRead.attributeId],
                    toString1(nodeToRead.attributeId,dataValue)
                ]);
            }
            attributeList.setRows(attr);
            attributeList.render();
        }
    })
}


function install_address_space_explorer() {

    var tree = widget_tree.tree({
        parent: screen,
        tags:true,
        fg: 'green',
        //Xx keys: true,
        label: ' {bold}{cyan-fg}Address Space{/cyan-fg}{/bold}',
        top: 'top+1',
        left: '0',
        width: '40%-2',
        height: '100%-10',
//xx    keys: true,
        vi: true,
        mouse: true,
        border: 'line',
        style: _.clone(style)

    });

    //allow control the table with the keyboard
    tree.on('select', function (node, index) {
        //x console.log("select "  +  node.content  + " at index =", index);
        fill_attributesRegion(node.node);
    });

    screen.append(tree);
    screen.key(['t'], function (ch, key) {
        tree.focus();
    });
    tree.key(["m"],function(ch,key) {
        var node =this.items[this.selected];
        if(node.monitoredItem) {
            console.log(" Already monitoring ",node.node.nodeId.toString());
            return;
        }
        monitor_item(node);
    });


    attributeList.key(['t'], function (ch, key) {
        console.log("setting focus to AdressSpace tree");
        tree.focus();
    });
    tree.key(['l'], function (ch, key) {
        attributeList.focus();
    });
    screen.key(['t'], function (ch, key) {
        console.log("setting focus to tree");
        tree.focus();
    });

    populateTree = function(){
        tree.setData({
            name: "RootFolder",
            nodeId: opcua.resolveNodeId("RootFolder"),
            children: expand_opcua_node
        });
    };

    tree.focus();
}

var monitoredItemsList = null;
function install_monitoredItemsWindow() {

    monitoredItemsList = blessed.listtable(
        {
            tags: true,
            parent: screen,
            top: "40%+1",
            left: w2+"-1",
            width: '60%-1',
            height: '60%-10',
            keys: true,
            label: 'Monitored Items',
            border: 'line',
            scrollbar: scrollbar,
            style: _.clone(style),
            align:"left"
        });

    screen.append(monitoredItemsList);

    //xx monitoredItemsList.setRows([["1","a"]])

}
var line =null;
function install_graphWindow() {
     line = contrib.line(
        {
            top: "40%+1",
            left: w2+"-1",
            width: '70%-1',
            height: '40%-10',
            keys: true,
            style: {
                line: "yellow"
                , text: "green"
                , baseline: "black"
            }
            , xLabelPadding: 3
            , xPadding: 5
            , showLegend: true
            , wholeNumbersOnly: false //true=do not show fraction in y axis
            , label: 'Title'
        });


    screen.append(line);

    var series1 = {
        title: 'apples',
        x: ['t1', 't2', 't3', 't4'],
        y: [5, 1, 7, 5]
    };
    line.setData(series1);


}

function install_logWindow() {

    var logWindow = blessed.list({

        tags: true,
        label: ' {bold}{cyan-fg}Info{/cyan-fg}{/bold}',

        top: '100%-8',
        left: 'left+1',
        width: '100%-2',
        height: 6,
        keys: true,
        border: 'line',
        scrollable: true,
        scrollbar: {
            ch: ' ',
            track: {
                bg: 'cyan'
            },
            style: {
                inverse: true
            }
        },
        style: {
            item: {
                hover: {
                    bg: 'blue'
                }
            },
            selected: {
                bg: 'blue',
                bold: true
            }
        }
    });

    console_log = console.log;
    var format = require("util").format;
    console.log = function () {

        var str = format.apply(null, arguments);
        lines = str.split("\n");
        lines.forEach(function(str) {
            logWindow.addItem(str);
        });
        logWindow.select(logWindow.items.length - 1);

        //xx   screen.render();
    };

    screen.append(logWindow);

    screen.key(['i'], function (ch, key) {
        console.log("setting focus to info");
        logWindow.focus();
    });

    logWindow.key(['c'],function(ch,key){
        logWindow.clearItems();
        logWindow.screen.render();
    });
}

install_logWindow();
install_address_space_explorer();
//xx install_graphWindow();
install_monitoredItemsWindow();

// Quit on Escape, q, or Control-C.
screen.key([/*'escape',*/ 'C-c'], function (ch, key) {
    return process.exit(0);
});

screen.key(['l'], function (ch, key) {
    console.log("setting focus to list");
    attributeList.focus();
});

// Render the screen.
screen.render();
console.log(" Welcome to Node-OPCUA CLI".red, "  Client".green);
