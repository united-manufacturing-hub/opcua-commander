// exports.TreeOld = require("./lib/widget/TreeOld.js")

const _ = require("underscore");
const assert = require("assert");
const chalk = require("chalk");
const blessed = require("blessed");
const List = blessed.List;

// some unicode icon characters ►▼◊◌○●□▪▫֎☺◘♦

function toContent(node, isLastChild, parent) {

    if (parent) {
        const sep =  (parent.isLastChild) ? " " : "│";
        node.prefix = parent.prefix + sep;
    } else {
        node.prefix=" ";
    }

    const s = (isLastChild) ? "└" : "├";

    const level = node.depth;
    assert(level >= 0 && level < 100);

    const hasChildren = node.children && node.children.length > 0;
    //    [+]
    const c = node.expanded ? (hasChildren ? chalk.green("▼ ") : chalk.blue("▼ ")) : "► ";
    const str = node.prefix + s + c + node.name;

    return str;
}
function dummy(node, callback) {
    callback(null, node.children);
}
class Tree extends List {
    
    constructor(options) {
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

        options.border = options.border || "line";
        options.scrollbar = options.scrollbar || scrollbar;
        options.style = options.style || style;

        options.keys = true;

        super(options);

        this.key(["+", "right"], this.expandSelected.bind(this));
        this.key(["-", "left"], this.collapseSelected.bind(this));

    }


    _add(node, isLastChild, parent) {
        const self = this;
        node.isLastChild = isLastChild;
        const item = self.add(toContent(node, isLastChild, parent));
        item.node = node;
        if (self._old_selectedNode === node) {
            self._index_selectedNode = self.items.length - 1;
        }
    }


    walk(node, depth) {

        const self = this;

        if (self.items.length) {
            self._old_selectedNode = self.items[self.selected].node;
            assert(self._old_selectedNode);
        }
        self._index_selectedNode = -1;
        this.setItems([]);

        if (node.name && depth === 0) {
            // root node
            node.depth = 0;
            self._add(node, true, null);
        }

        function dumpChildren(node, depth) {

            if (_.isFunction(node.children)) {
                return;
            }
            node.children = node.children || [];
            let isLastChild;

            for (let i = 0; i < node.children.length; i++) {

                const child = node.children[i];
                if (child) {
                    child.depth = depth + 1;

                    isLastChild = (i === node.children.length - 1);
                    self._add(child, isLastChild, node);
                    if (child.expanded && !_.isFunction(child.children)) {
                        dumpChildren(child, depth + 1);
                    }

                }
            }
        }

        if (node.expanded) {
            dumpChildren(node, depth);
        }
        self._index_selectedNode = self._index_selectedNode >= 0 ? self._index_selectedNode : 0;
        self.select(self._index_selectedNode);

    }


    expandSelected() {

        const self = this;
        const node = self.items[self.selected].node;


        if (node.expanded) {
            return;
        }

        const populate_children = _.isFunction(node.children) ? node.children : dummy;
        populate_children(node, function (err, children) {
            if (err) {
                return;
            }
            assert(_.isArray(children));
            node.children = children;
            node.expanded = true;
            self.setData(self.__data);
        });
    }

    collapseSelected() {
        const self = this;
        const node = self.items[self.selected].node;
        if (!node.expanded) {
            return;
        }
        node.expanded = false;
        this.setData(this.__data);
    }

    setData(data) {

        this.__data = data;
        this.walk(data, 0);
        this.screen.render();
    }
}

exports.Tree = Tree;

