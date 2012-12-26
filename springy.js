/**
 * Springy v1.0.1
 *
 * Copyright (c) 2010 Dennis Hotson
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

"use strict";

var _ = require("underscore");
var util = require("util");

module.exports = function() {
	var graph = new Graph();
	return graph.api;
};

var Graph = function() {
		this.nodeSet = {};
		this.nodes = [];
		this.edges = [];
		this.adjacency = {};

		this.nextNodeId = 0;
		this.nextEdgeId = 0;
		this.eventListeners = [];

		Object.defineProperty(this, "api", {
			value: Object.freeze(getApi.call(this)),
			enumerable: true
		});
	};

/**
 * The exposed api for the graph function
 * @return {object} The api for the force directed graph
 */
var getApi = function() {
		var api = {};
		api.newNode = this.newNode.bind(this);
		api.newEdge = this.newEdge.bind(this);
		api.generateLayout = this.generateLayout.bind(this);
		return api;
	};

var Node = function(id, data) {
		this.id = id;
		this.data = typeof(data) !== 'undefined' ? data : {};
	};

var Edge = function(id, source, target, data) {
		this.id = id;
		this.source = source;
		this.target = target;
		this.data = typeof(data) !== 'undefined' ? data : {};
	};

Graph.prototype.addNode = function(node) {
	if(typeof(this.nodeSet[node.id]) === 'undefined') {
		this.nodes.push(node);
	}

	this.nodeSet[node.id] = node;

	this.notify();
	return node;
};

Graph.prototype.addEdge = function(edge) {
	var exists = false;
	_.each(this.edges, function(e) {
		if(edge.id === e.id) {
			exists = true;
		}
	});

	if(!exists) {
		this.edges.push(edge);
	}

	if(typeof(this.adjacency[edge.source.id]) === 'undefined') {
		this.adjacency[edge.source.id] = {};
	}
	if(typeof(this.adjacency[edge.source.id][edge.target.id]) === 'undefined') {
		this.adjacency[edge.source.id][edge.target.id] = [];
	}

	exists = false;
	_.each(this.adjacency[edge.source.id][edge.target.id], function(e) {
		if(edge.id === e.id) {
			exists = true;
		}
	});

	if(!exists) {
		this.adjacency[edge.source.id][edge.target.id].push(edge);
	}

	this.notify();
	return edge;
};

Graph.prototype.newNode = function(data) {
	var node = new Node(this.nextNodeId++, data);
	this.addNode(node);
	return node;
};

Graph.prototype.newEdge = function(source, target, data) {
	var edge = new Edge(this.nextEdgeId++, source, target, data);
	this.addEdge(edge);
	return edge;
};

// find the edges from node1 to node2
Graph.prototype.getEdges = function(node1, node2) {
	if(typeof(this.adjacency[node1.id]) !== 'undefined' && typeof(this.adjacency[node1.id][node2.id]) !== 'undefined') {
		return this.adjacency[node1.id][node2.id];
	}

	return [];
};

// remove a node and it's associated edges from the graph
Graph.prototype.removeNode = function(node) {
	if(typeof(this.nodeSet[node.id]) !== 'undefined') {
		delete this.nodeSet[node.id];
	}

	for(var i = this.nodes.length - 1; i >= 0; i--) {
		if(this.nodes[i].id === node.id) {
			this.nodes.splice(i, 1);
		}
	}

	this.detachNode(node);

};

// removes edges associated with a given node
Graph.prototype.detachNode = function(node) {
	var that = this;
	var tmpEdges = this.edges.slice();
	_.each(tmpEdges, function(e) {
		if(e.source.id === node.id || e.target.id === node.id) {
			that.removeEdge(e);
		}
	});

	this.notify();
};

// remove a node and it's associated edges from the graph
Graph.prototype.removeEdge = function(edge) {
	for(var i = this.edges.length - 1; i >= 0; i--) {
		if(this.edges[i].id === edge.id) {
			this.edges.splice(i, 1);
		}
	}

	for(var x in this.adjacency) {
		if(this.adjacency.hasOwnProperty(x)) {
			for(var y in this.adjacency[x]) {
				if(this.adjacency.hasOwnProperty(y)) {
					var edges = this.adjacency[x][y];

					for(var j = edges.length - 1; j >= 0; j--) {
						if(this.adjacency[x][y][j].id === edge.id) {
							this.adjacency[x][y].splice(j, 1);
						}
					}
				}
			}
		}
	}

	this.notify();
};

/* Merge a list of nodes and edges into the current graph. eg.
var o = {
	nodes: [
		{id: 123, data: {type: 'user', userid: 123, displayname: 'aaa'}},
		{id: 234, data: {type: 'user', userid: 234, displayname: 'bbb'}}
	],
	edges: [
		{from: 0, to: 1, type: 'submitted_design', directed: true, data: {weight: }}
	]
}
*/
Graph.prototype.merge = function(data) {
	var nodes = [];
	var that = this;
	_.each(data.nodes, function(n) {
		nodes.push(that.addNode(new Node(n.id, n.data)));
	});

	_.each(data.edges, function(e) {
		var from = nodes[e.from];
		var to = nodes[e.to];
		var id;
		if(e.directed) {
			id = e.type + "-" + from.id + "-" + to.id;
		} else if(from.id < to.id) { // normalise id for non-directed edges
			id = e.type + "-" + from.id + "-" + to.id;
		} else {
			id = e.type + "-" + to.id + "-" + from.id;
		}

		var edge = that.addEdge(new Edge(id, from, to, e.data));
		edge.data.type = e.type;
	});
};

Graph.prototype.filterNodes = function(fn) {
	var that = this;
	var tmpNodes = this.nodes.slice();
	_.each(tmpNodes, function(n) {
		if(!fn(n)) {
			that.removeNode(n);
		}
	});
};

Graph.prototype.filterEdges = function(fn) {
	var that = this;
	var tmpEdges = this.edges.slice();
	_.each(tmpEdges, function(e) {
		if(!fn(e)) {
			that.removeEdge(e);
		}
	});
};


Graph.prototype.addGraphListener = function(obj) {
	this.eventListeners.push(obj);
};

Graph.prototype.notify = function() {
	_.each(this.eventListeners, function(obj) {
		obj.graphChanged();
	});
};

Graph.prototype.generateLayout = function(config) {
	var stiffness = config.stiffness;
	var repulsion = config.repulsion;
	var damping = config.damping;
	var incremental = config.incremental;

	var layout = new Layout.ForceDirected(this, stiffness, repulsion, damping);
	layout.start(incremental);
	util.log("layout edges:" + util.inspect(layout.edgeSprings, true, null));
	util.log("layout nodes:" + util.inspect(layout.nodePoints, true, null));
};

// -----------
var Layout = {};
Layout.ForceDirected = function(graph, stiffness, repulsion, damping) {
	this.graph = graph;
	this.stiffness = stiffness; // spring stiffness constant
	this.repulsion = repulsion; // repulsion constant
	this.damping = damping; // velocity damping factor
	this.nodePoints = {}; // keep track of points associated with nodes
	this.edgeSprings = {}; // keep track of springs associated with edges
};

Layout.ForceDirected.prototype.point = function(node) {
	if(typeof(this.nodePoints[node.id]) === 'undefined') {
		var mass = typeof(node.data.mass) !== 'undefined' ? node.data.mass : 1.0;
		this.nodePoints[node.id] = new Layout.ForceDirected.Point(Vector.random(), mass);
	}

	return this.nodePoints[node.id];
};

Layout.ForceDirected.prototype.spring = function(edge) {
	var that = this;
	if(typeof(this.edgeSprings[edge.id]) === 'undefined') {
		var length = typeof(edge.data.length) !== 'undefined' ? edge.data.length : 1.0;

		var existingSpring = false;

		var from = this.graph.getEdges(edge.source, edge.target);
		_.each(from, function(e) {
			if(existingSpring === false && typeof(that.edgeSprings[e.id]) !== 'undefined') {
				existingSpring = that.edgeSprings[e.id];
			}
		});

		if(existingSpring !== false) {
			return new Layout.ForceDirected.Spring(existingSpring.point1, existingSpring.point2, 0.0, 0.0);
		}

		var to = this.graph.getEdges(edge.target, edge.source);
		_.each(from, function(e) {
			if(existingSpring === false && typeof(that.edgeSprings[e.id]) !== 'undefined') {
				existingSpring = that.edgeSprings[e.id];
			}
		});

		if(existingSpring !== false) {
			return new Layout.ForceDirected.Spring(existingSpring.point2, existingSpring.point1, 0.0, 0.0);
		}

		this.edgeSprings[edge.id] = new Layout.ForceDirected.Spring(
		this.point(edge.source), this.point(edge.target), length, this.stiffness);
	}

	return this.edgeSprings[edge.id];
};

// callback should accept two arguments: Node, Point
Layout.ForceDirected.prototype.eachNode = function(callback) {
	var that = this;
	_.each(this.graph.nodes, function(n) {
		callback.call(that, n, that.point(n));
	});
};

// callback should accept two arguments: Edge, Spring
Layout.ForceDirected.prototype.eachEdge = function(callback) {
	var that = this;
	_.each(this.graph.edges, function(e) {
		callback.call(that, e, that.spring(e));
	});
};

// callback should accept one argument: Spring
Layout.ForceDirected.prototype.eachSpring = function(callback) {
	var that = this;
	_.each(this.graph.edges, function(e) {
		callback.call(that, that.spring(e));
	});
};


// Physics stuff
Layout.ForceDirected.prototype.applyCoulombsLaw = function() {
	this.eachNode(function(n1, point1) {
		this.eachNode(function(n2, point2) {
			if(point1 !== point2) {
				var d = point1.p.subtract(point2.p);
				var distance = d.magnitude() + 0.1; // avoid massive forces at small distances (and divide by zero)
				var direction = d.normalise();

				// apply force to each end point
				point1.applyForce(direction.multiply(this.repulsion).divide(distance * distance * 0.5));
				point2.applyForce(direction.multiply(this.repulsion).divide(distance * distance * -0.5));
			}
		});
	});
};

Layout.ForceDirected.prototype.applyHookesLaw = function() {
	this.eachSpring(function(spring) {
		var d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
		var displacement = spring.length - d.magnitude();
		var direction = d.normalise();

		// apply force to each end point
		spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
		spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
	});
};

Layout.ForceDirected.prototype.attractToCentre = function() {
	this.eachNode(function(node, point) {
		var direction = point.p.multiply(-1.0);
		point.applyForce(direction.multiply(this.repulsion / 50.0));
	});
};


Layout.ForceDirected.prototype.updateVelocity = function(timestep) {
	this.eachNode(function(node, point) {
		// Is this, along with updatePosition below, the only places that your
		// integration code exist?
		point.v = point.v.add(point.a.multiply(timestep)).multiply(this.damping);
		point.a = new Vector(0, 0);
	});
};

Layout.ForceDirected.prototype.updatePosition = function(timestep) {
	this.eachNode(function(node, point) {
		// Same question as above; along with updateVelocity, is this all of
		// your integration code?
		point.p = point.p.add(point.v.multiply(timestep));
	});
};

// Calculate the total kinetic energy of the system
Layout.ForceDirected.prototype.totalEnergy = function(timestep) {
	var energy = 0.0;
	this.eachNode(function(node, point) {
		var speed = point.v.magnitude();
		energy += 0.5 * point.m * speed * speed;
	});

	return energy;
};

// start simulation
Layout.ForceDirected.prototype.start = function(render, done) {
	this._finished = false;
	while (!this._finished) {
		this.computeStep(render);
	}
	if (done) {
		done(this);
	}
};

Layout.ForceDirected.prototype.computeStep = function(callback) {
	this.applyCoulombsLaw();
	this.applyHookesLaw();
	this.attractToCentre();
	this.updateVelocity(0.03);
	this.updatePosition(0.03);

	// stop simulation when energy of the system goes below a threshold
	if(this.totalEnergy() < 0.01) {
		this._finished = true;
	}

	if (callback) {
		callback(this);	
	}
};

// Find the nearest point to a particular position
Layout.ForceDirected.prototype.nearest = function(pos) {
	var min = {
		node: null,
		point: null,
		distance: null
	};
	var t = this;
	_.each(this.graph.nodes, function(n) {
		var point = t.point(n);
		var distance = point.p.subtract(pos).magnitude();

		if(min.distance === null || distance < min.distance) {
			min = {
				node: n,
				point: point,
				distance: distance
			};
		}
	});

	return min;
};

// returns [bottomleft, topright]
Layout.ForceDirected.prototype.getBoundingBox = function() {
	var bottomleft = new Vector(-2, -2);
	var topright = new Vector(2, 2);

	this.eachNode(function(n, point) {
		if(point.p.x < bottomleft.x) {
			bottomleft.x = point.p.x;
		}
		if(point.p.y < bottomleft.y) {
			bottomleft.y = point.p.y;
		}
		if(point.p.x > topright.x) {
			topright.x = point.p.x;
		}
		if(point.p.y > topright.y) {
			topright.y = point.p.y;
		}
	});

	var padding = topright.subtract(bottomleft).multiply(0.07); // ~5% padding
	return {
		bottomleft: bottomleft.subtract(padding),
		topright: topright.add(padding)
	};
};


// Vector
var Vector = function(x, y) {
		this.x = x;
		this.y = y;
	};

Vector.random = function() {
	return new Vector(10.0 * (Math.random() - 0.5), 10.0 * (Math.random() - 0.5));
};

Vector.prototype.add = function(v2) {
	return new Vector(this.x + v2.x, this.y + v2.y);
};

Vector.prototype.subtract = function(v2) {
	return new Vector(this.x - v2.x, this.y - v2.y);
};

Vector.prototype.multiply = function(n) {
	return new Vector(this.x * n, this.y * n);
};

Vector.prototype.divide = function(n) {
	return new Vector((this.x / n) || 0, (this.y / n) || 0); // Avoid divide by zero errors..
};

Vector.prototype.magnitude = function() {
	return Math.sqrt(this.x * this.x + this.y * this.y);
};

Vector.prototype.normal = function() {
	return new Vector(-this.y, this.x);
};

Vector.prototype.normalise = function() {
	return this.divide(this.magnitude());
};

// Point
Layout.ForceDirected.Point = function(position, mass) {
	this.p = position; // position
	this.m = mass; // mass
	this.v = new Vector(0, 0); // velocity
	this.a = new Vector(0, 0); // acceleration
};

Layout.ForceDirected.Point.prototype.applyForce = function(force) {
	this.a = this.a.add(force.divide(this.m));
};

// Spring
Layout.ForceDirected.Spring = function(point1, point2, length, k) {
	this.point1 = point1;
	this.point2 = point2;
	this.length = length; // spring length at rest
	this.k = k; // spring constant (See Hooke's law) .. how stiff the spring is
};