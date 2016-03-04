// exports.TreeOld = require('./lib/widget/TreeOld.js')

var _ =require("underscore");
var assert = require("assert");
var async = require("async");

var blessed = require('blessed')
    , Node = blessed.Node
    , List = blessed.List
    , Box = blessed.Box
    ;

// some unicode icon characters ►▼◊◌○●□▪▫֎☺◘♦

function Tree(options) {
    if (!(this instanceof Node)) {
        return new Tree(options);
    }


    var scrollbar= {
        ch: ' ',
            track: {
            bg: 'cyan'
        },
        style: {
            inverse: true
        }
    };

    var style= {
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

    options.border = options.border || 'line';
    options.scrollbar = options.scrollbar || scrollbar;
    options.style     = options.style || style;

    options.keys =  true;

    List.call(this, options);

    this.key(['+','right'],this.expandSelected.bind(this));
    this.key(['-','left'],this.collapseSelected.bind(this));

}

Tree.prototype.__proto__ = List.prototype;

Tree.prototype.type = 'list';

function toContent(node,isLastChild,parent) {

    node.prefix =parent ? (parent.prefix +  ( (parent.isLastChild) ? ' ' :  '│')) : " ";

    var s =  (isLastChild) ? '└' :  '├';

    var level = node.depth;
    assert( level >= 0 && level <100);

    var hasChildren = node.children && node.children.length > 0;
    //    [+]
    // var c = node.expanded ? (hasChildren ? "┬ ".green : "  ")  : "+ ";
    var c = node.expanded ? (hasChildren ? "▼ ".green : "▼ ".blue)  : "► ";
    var str = node.prefix + s + c + node.name;

    return str;
}

Tree.prototype._add = function (node,isLastChild,parent) {

    var self = this;
    node.isLastChild = isLastChild;
    var item = self.add(toContent(node,isLastChild,parent));
    item.node = node;
    if(self._old_selectedNode === node) {
        self._index_selectedNode = self.items.length -1;
    }
};



Tree.prototype.walk = function (node,depth) {

    var self = this;

    if (self.items.length) {
        self._old_selectedNode = self.items[self.selected].node;
        assert(self._old_selectedNode);
    }
    self._index_selectedNode = -1;
    this.setItems([]);

    if (node.name && depth === 0) {
        // root node
        node.depth = 0;
        self._add(node,true,null);
    }

    function dumpChildren(node,depth) {

        if (_.isFunction(node.children)) {
            return;
        }
        node.children= node.children || [];
        var i,isLastChild;

        for (i=0;i<node.children.length;i++) {

            var child = node.children[i];
            if (child) {
                child.depth = depth+1;

                isLastChild = (i === node.children.length -1);
                self._add(child,isLastChild,node);
                if (child.expanded && !_.isFunction(child.children)) {
                    dumpChildren(child,depth+1);
                }

            }
        }
    }
    if (node.expanded) {
        dumpChildren(node, depth);
    }
    self._index_selectedNode = self._index_selectedNode >=0 ? self._index_selectedNode: 0;
    self.select(self._index_selectedNode)

};

function dummy(node,callback) {
    callback(null,node.children);
}

Tree.prototype.expandSelected = function() {

    var self = this;
    var node = self.items[self.selected].node;


    if (node.expanded) {
        return;
    }

    var populate_children = _.isFunction(node.children) ? node.children : dummy;
    populate_children(node,function(err,children) {
        assert(_.isArray(children));
        node.children = children;
        node.expanded = true;
        self.setData(self.__data);
    });
 };

Tree.prototype.collapseSelected = function() {
    var self = this;
    var node = self.items[self.selected].node;
    if (!node.expanded) {
        return;
    }
    node.expanded= false;
    console.log(" collasping",self.selected);
    this.setData(this.__data);
};

Tree.prototype.setData = function(data) {

    this.__data = data;
    this.walk(data,0);
    this.screen.render();
};

exports.tree = Tree;

