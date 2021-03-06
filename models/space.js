var rn = require('random-number');
var wolves = require('./wolf');
var rabbits = require('./rabbit');
var _= require('underscore');

let moves=[+1,0,-1];
var move_options = {
    min:  0,
    max:  2,
    integer: true
};
var initSpace = function(space){
    global.grid = [];
    for(var x = 0; x < space; x++){
        global.grid[x] = [];
        for(var y = 0; y < space; y++){
            global.grid[x][y] = 0;
        }
    }
    // console.log(global.grid)
};
let getPositionXY = function(type,x,y,obj){
    //responsible for checking available positions and assigning new positions within space limits
    let movable_space =  moves;
    let movable_options = move_options;
    if(typeof(x) === "undefined" || typeof(y) === "undefined"){
       // console.log('in without x and y')
       if(typeof(global.grid) === "undefined")
       {
           initSpace(process.env.TOTAL_SPACE);
       }
        movable_space = global.grid[0];
        movable_options = {
            min:0,
            max:global.grid[0].length-1,
            integer:true
        };
    }else{
        //let's check for nearby food and predators
        let check = checkNearbyFoodAndPredator(type,x,y,obj);
        if(typeof(check.X) != "undefined" && typeof(check.Y) != "undefined"){
            return check;
        }
    }

    //no food and predators found hence roaming other places in search of food

    let X = rn(movable_options);
    let Y = rn(movable_options);
    if(typeof(x) != "undefined" && typeof(y) != "undefined"){
        if(x+1 >= global.grid[0].length){
            X = global.grid[0].length-1;
        }else if(x+movable_space[X]<0){
            X = 0;
        }else{
            X = x+movable_space[X];
        }
        if(y+1 >= global.grid[0].length){
            Y = global.grid[0].length-1;
        }else if(y+movable_space[Y]<0){
            Y = 0;
        }else{
            Y = y+movable_space[Y];
        }
    }
    if(positionExists(X,Y)
        && global.grid[X][Y] == 0){
        pos = determineEnvironmentPosition(type);
        global.grid[X][Y]=pos;
        if(typeof(x) != "undefined" && typeof(y) != "undefined"){
            if(pos != 1)
                global.grid[x][y]=0;
        }
        //console.log(global.grid);
        if(X < 0 || Y <0){
            console.log('less than zero set',X,Y);
            process.exit();
        }
        
    // console.log("from x and y ",x,y, ' to ',X,Y);
        return {
            "X":X,
            "Y":Y
        };
    }
    // console.log("not moved");

    if(typeof(x) != "undefined" && typeof(y) != "undefined"){
        return {
            "X":x,
            "Y":y
        };
    }else{
        if(typeof(x) === "undefined" || typeof(y) === "undefined"){
            return getPositionXY(type);
        }
        //the world is busy
    }
};

//determine status in environment (the higher the dangerous)
let  determineEnvironmentPosition = function(type){
    let pos;    
    if(type == "wolves"){
            pos = 3;
        }else if(type == "rabbits"){
            pos = 2;
        }else{
            pos = 1;
        }
        return pos;
};

// To check nearby predator
// both rabbits and wolves sense each other upto 2 point radius
let checkNearbyFoodAndPredator = function(type,x,y,obj){
    let nearby=[];
    let X=x,Y=y;
    let currentEnvPos = determineEnvironmentPosition(type);
    if(currentEnvPos == 1){
        return [];
    }
    let check_pos = 2;
    if((typeof(obj.inDanger) !=="undefined"  && obj.inDanger == 1) || 
    (typeof(obj.nearFood) !== "undefined" && obj.nearFood == 1)){
        check_pos = 4;
    }
    for(let i=x-check_pos;i<x+check_pos;i++){
        if(i>=0 && typeof(global.grid[i])!=="undefined"){
            for(let j=y-check_pos;j<y+check_pos;j++){
                if(j>=0 && typeof(global.grid[i][j])!=="undefined"){
                    if(parseInt(global.grid[i][j]) != 0 
                    && parseInt(global.grid[i][j]) != currentEnvPos){
                        nearby.push({
                            posX:i,
                            posY:j,
                            type:global.grid[i][j]
                        });
                    } 
                }
            }
        }  
    }
    
    if(nearby.length>0){
        nearby.sort(function(a,b){  // sort for nearest first 
            let aCord = Math.abs(a.posX-x-a.posY-y);let bCord = Math.abs(b.posX-x-b.posY-y);
                if(aCord<bCord)
                    return -1;
                else if(bCord<aCord)
                    return 1;
                else
                    return 0;
            }).sort(function(a,b){ //again sort for first danger then food 
                if(a.type<b.type)
                    return -1;
                else if(b.type<a.type)
                    return 1;
                else
                    return 0;
            });
        for(var i in nearby){
            if(nearby[i].type > currentEnvPos){   //danger move away from it
                if(x - nearby[i].posX > 0){
                    X = x+1;
                }else if(nearby[i].posX - x > 0){
                    X = x-1;
                }
                if(y - nearby[i].posY > 0){
                    Y = y+1;
                }else if(nearby[i].posY - y > 0){
                    Y = y-1;
                }
                //broadCast danger message
                rabbits.inDanger(x,y);
                if(positionExists(X,Y) && canPositionOverride(currentEnvPos,X,Y))
                    return [X,Y];
            }else if(nearby[i].type+1 === currentEnvPos){   // yummy move towards the food
                if(x - nearby[i].posX > 0){
                    X = x-1;
                }else if(nearby[i].posX - x > 0){
                    X = x+1;
                }
                if(y - nearby[i].posY > 0){
                    Y = y-1;
                }else if(nearby[i].posY - y > 0){
                    Y = y+1;
                }
                // broadcast the message for food
                if(currentEnvPos == 2){
                    rabbits.foodNear(X,Y);
                }else{
                    wolves.foodNear(X,Y);
                }
                if(positionExists(X,Y) && canPositionOverride(currentEnvPos,X,Y)){
                    global.grid[X][Y]=currentEnvPos;
                    global.grid[x][y]=0;
                    if(nearby[i].posX == X && nearby[i].posY == Y){
                        if(currentEnvPos == 2){
                            let rabbit_id = obj.id;
                            let carrotIndex = global.carrots.findIndex(r => r.position_x==X && r.position_y == Y);
                            rabbits.eatCarrot(rabbit_id,carrotIndex);
                        }else if(currentEnvPos == 3){
                            let wolf_id = obj.id;
                            var rabbitIndex = findIndexByLocation(global.rabbits,X, Y);
                            wolves.eatRabbit(wolf_id,rabbitIndex);
                        }
                    }
                    return {"X":X,"Y":Y};
                }
            }else{  // encounter brothers/sisters 
              //do nothing  
            }
        }
    }
    return [];
};

var positionExists = function(x,y){
    return typeof(global.grid[x]) !== "undefined" && typeof(global.grid[x][y]) !== 'undefined';
};

var canPositionOverride = function(current_type,x,y){
    return current_type > global.grid[x][y]; 
}

var findIndexByLocation = function(array, x, y) {
    for (var i = 0; i < array.length; i++) {
        if (array[i].position_x === x && array[i].position_y===y) {
            return i;
        }
    }
    return null;
};

let isSpaceAvailable = function(){
    for(let i =0 ;i<global.grid[0];i++){
        if(global.grid[i].filter(point => point > 0).length){
            return true;
        }
    }
    return false;
};

module.exports = {
    "initSpace":initSpace,
    "getPositionXY":getPositionXY,
    "isSpaceAvailable":isSpaceAvailable
};
