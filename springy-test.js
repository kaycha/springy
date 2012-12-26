"use strict";

var springy = require("./springy")();

var dennis = springy.newNode({label: 'Dennis'});
var michael = springy.newNode({label: 'Michael'});
var jessica = springy.newNode({label: 'Jessica'});
var timothy = springy.newNode({label: 'Timothy'});
var barbara = springy.newNode({label: 'Barbara'});
var franklin = springy.newNode({label: 'Franklin'});
var monty = springy.newNode({label: 'Monty'});
var james = springy.newNode({label: 'James'});
var bianca = springy.newNode({label: 'Bianca'});

springy.newEdge(dennis, michael, {color: '#00A0B0'});
springy.newEdge(michael, dennis, {color: '#6A4A3C'});
springy.newEdge(michael, jessica, {color: '#CC333F'});
springy.newEdge(jessica, barbara, {color: '#EB6841'});
springy.newEdge(michael, timothy, {color: '#EDC951'});
springy.newEdge(franklin, monty, {color: '#7DBE3C'});
springy.newEdge(dennis, monty, {color: '#000000'});
springy.newEdge(monty, james, {color: '#00A0B0'});
springy.newEdge(barbara, timothy, {color: '#6A4A3C'});
springy.newEdge(dennis, bianca, {color: '#CC333F'});
springy.newEdge(bianca, monty, {color: '#EB6841'});

springy.generateLayout(400, 400, 0.5);