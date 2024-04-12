const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const SIDEBAR_WIDTH = 5;

let COLORS = {};

const NEIGHBORHOOD_SIZE = 2;
let neighborhoodTable = document.getElementById("cluehood");
for (let roff = -NEIGHBORHOOD_SIZE; roff <= NEIGHBORHOOD_SIZE; roff++) {
    let row = document.createElement("tr");
    for (let coff = -NEIGHBORHOOD_SIZE; coff <= NEIGHBORHOOD_SIZE; coff++) {
        let cell = document.createElement("td");
        row.appendChild(cell);
        if (!(roff || coff)) continue;
        let input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Math.abs(roff) <= 1 && Math.abs(coff) <= 1;
        input.id = `nh${roff},${coff}`;
        cell.appendChild(input);
    }
    neighborhoodTable.appendChild(row);
}
let neighborhoodPresets = document.getElementById("cluehoodpresets");
const PRESETS = [
    ["Default", x => Math.abs(x.r) <= 1 && Math.abs(x.c) <= 1],
    ["Knight", x => x.r ** 2 + x.c ** 2 === 5],
    ["Stripes", x => Math.abs(x.r) <= 2 && (x.r & 1) === 0 && Math.abs(x.c) <= 1],
    ["Adjacent", x => x.r ** 2 + x.c ** 2 === 1],
    ["Upward", x => x.r < 0 && Math.abs(x.c) <= 1]
];
for (let preset of PRESETS) {
    let button = document.createElement("button");
    button.type = "button";
    button.appendChild(document.createTextNode(preset[0]));
    button.addEventListener("click", function (e) {
        for (let roff = -NEIGHBORHOOD_SIZE; roff <= NEIGHBORHOOD_SIZE; roff++) {
            for (let coff = -NEIGHBORHOOD_SIZE; coff <= NEIGHBORHOOD_SIZE; coff++) {
                let cb = document.getElementById(`nh${roff},${coff}`);
                if (cb) cb.checked = preset[1]({r: roff, c: coff});
            }
        }
    });
    neighborhoodPresets.appendChild(button);
}

function updateColorScheme() {
    for (let i of [...document.querySelectorAll("#colorscheme input")]) {
        if (i.id.startsWith("c")) {
            let hex = parseInt(i.value.slice(1), 16);
            let color = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
            COLORS[i.id.slice(1)] = color;
        } else if (i.id.startsWith("p")) {
            COLORS[i.id.slice(1)] = i.value / 100;
        }
    }
    if (board) drawBoard();
}

for (let i of [...document.querySelectorAll("#colorscheme input")]) {
    i.addEventListener("input", updateColorScheme);
}

const inputs = {};
for (let x of [...document.querySelectorAll("input")]) inputs[x.id] = x;
let TILE_SIZE = 16;
const FLAG_TYPES = [0, 1, 2, 3, 4, -1, -2, -3, -4];

const IMAGES = {};
function loadImage(img) {
    IMAGES[img] = new Image(TILE_SIZE, TILE_SIZE);
    IMAGES[img].src = "images/" + img + ".png";
}
for (let i = -4; i <= 4; i++) {
    if (i) {
        loadImage("flag" + i);
        loadImage("mine" + i);
    }
}
for (let i = -19; i <= 19; i++) loadImage("num" + i);
for (let x of "clicked question redtile tile x".split(" ")) loadImage(x);

document.getElementById("size").addEventListener("input", () => {
    TILE_SIZE = document.getElementById("size").value;
    updateCanvasSize();
    drawBoard();
});

let board;
let isGameOver = false;
let isWin = false;
let mouse = null;
document.addEventListener("mousemove", (event) => {
    let rect = canvas.getBoundingClientRect();
    let x = event.x - rect.left;
    let y = event.y - rect.top;
    let r = Math.floor(y / TILE_SIZE);
    let c = Math.floor(x / TILE_SIZE);
    if (r < 0 || c < 0 || r >= board.length || c >= board[0].length)
        mouse = null;
    else
        mouse = {r: r, c: c};
    drawBoard();
});

updateColorScheme();
const INITIAL_COLOR_SCHEME = JSON.parse(JSON.stringify(COLORS));

function resetColorScheme() {
    COLORS = JSON.parse(JSON.stringify(INITIAL_COLOR_SCHEME));
    for (let i of [...document.querySelectorAll("#colorscheme input")]) {
        let value;
        if (i.id.startsWith("c")) {
            let color = COLORS[i.id.slice(1)];
            let hex = (color[0] << 16) | (color[1] << 8) | color[2];
            value = "#" + hex.toString(16).padStart(6, "0");
        } else if (i.id.startsWith("p")) {
            value = COLORS[i.id.slice(1)] * 100;
        } else {
            value = COLORS[i.id];
        }
        i.value = value;
    }
    drawBoard();
}

function rand(x) {
    return Math.floor(Math.random() * x);
}

function isInBounds(pos) {
    return pos.r >= 0 && pos.r < board.length &&
           pos.c >= 0 && pos.c < board[pos.r].length;
}

function updateCanvasSize() {
    canvas.width = TILE_SIZE * (+inputs.width.value + SIDEBAR_WIDTH);
    canvas.height = TILE_SIZE * inputs.height.value;
}

function createBoard() {
    let inputData = {};
    for (let k of Object.keys(inputs)) {
        switch (inputs[k].type) {
            case "checkbox":
            case "radio":
                inputData[k] = inputs[k].checked;
                break;
            default:
                inputData[k] = inputs[k].value;
        }
    }
    board = new Array(+inputData.height).fill(0)
        .map(x => new Array(+inputData.width).fill(0)
            .map(y => ({mines: 0, flags: 0, opened: false, clue: null})));
    board.data = inputData;
    board.flags = {};
    let possibleMinePositions = [];
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            possibleMinePositions.push({r: r, c: c});
        }
    }
    for (let numMines of FLAG_TYPES.slice(1)) {
        let k = (numMines < 0 ? "a" : "") + "mines" + Math.abs(numMines);
        for (let i = 0; i < inputData[k] && possibleMinePositions.length; i++) {
            let idx = rand(possibleMinePositions.length);
            let minePosition = possibleMinePositions[idx];
            possibleMinePositions.splice(idx, 1);
            board[minePosition.r][minePosition.c].mines = numMines;
            board.flags[numMines] = 0;
        }
    }
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            let neighbors = getNeighbors(r, c);
            let totalMineCount = 0;
            let encounteredMine = false;
            for (let neighbor of neighbors) {
                if (isInBounds(neighbor)) {
                    let mines = board[neighbor.r][neighbor.c].mines;
                    if (mines) {
                        encounteredMine = true;
                        totalMineCount += mines;
                    }
                }
            }
            if (encounteredMine) board[r][c].clue = totalMineCount;
        }
    }
}

function getNeighbors(r, c) {
    let neighbors = [];
    for (let roff = -NEIGHBORHOOD_SIZE; roff <= NEIGHBORHOOD_SIZE; roff++) {
       for (let coff = -NEIGHBORHOOD_SIZE; coff <= NEIGHBORHOOD_SIZE; coff++) {
           if (board.data[`nh${roff},${coff}`])
               neighbors.push({r: r + roff, c: c + coff});
       }
    }
    if (board.data.wraphnorm)
        neighbors = neighbors.map(
            x => ({r: x.r, c: (x.c + board[0].length) % board[0].length})
        );
    if (board.data.wraphinv)
        neighbors = neighbors.map(x => {
            let row = x.r;
            let col = (x.c + board[0].length) % board[0].length;
            if (x.c !== col) row = board.length - 1 - row;
            return {r: row, c: col};
        });
    if (board.data.wrapvnorm)
        neighbors = neighbors.map(
            x => ({r: (x.r + board.length) % board.length, c: x.c})
        );
    if (board.data.wrapvinv)
        neighbors = neighbors.map(x => {
            let col = x.c;
            let row = (x.r + board.length) % board.length;
            if (x.r !== row) col = board[0].length - 1 - col;
            return {r: row, c: col};
        });
    return neighbors;
}

function drawBoard() {
    if (Object.values(IMAGES).some(x => !x.complete)) {
        setTimeout(drawBoard, 10);
        return;
    }
    let mineCounts = {};
    for (let numMines of FLAG_TYPES.slice(1)) {
        let k = (numMines < 0 ? "a" : "") + "mines" + Math.abs(numMines);
        mineCounts[numMines] = +board.data[k];
    }
    mineCounts[0] = board.length * board[0].length - Object.values(mineCounts).reduce((a,b)=>a+b);
    let flagCounts = {};
    let missingImage = IMAGES.question;
    let rectsToDraw = {};
    for (let r = 0; r < board.length; r++) {
        let y = TILE_SIZE * r;
        for (let c = 0; c < board[r].length; c++) {
            let x = TILE_SIZE * c;
            let tile = board[r][c];
            let flags = tile.flags;
            if (flags === 0)
                flagCounts[0] = (flagCounts[0] ?? 0) + tile.opened;
            else
                flagCounts[flags] = (flagCounts[flags] ?? 0) + 1;
            let images = getImages(tile).map(x => IMAGES[x] || missingImage);
            for (let image of images)
                ctx.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
            let color = getColor(r, c);
            if (color) {
                color = `rgba(${color}, ${COLORS.opacity})`;
                rectsToDraw[color] ??= [];
                rectsToDraw[color].push({x: x, y: y});
            }
        }
    }
    for (let color in rectsToDraw) {
        ctx.fillStyle = color;
        let rects = rectsToDraw[color];
        for (let {x, y} of rects)
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
    let mineTypes = FLAG_TYPES.filter(x => mineCounts[x]);
    ctx.fillStyle = `rgb(${COLORS.sidebar})`;
    ctx.fillRect(board[0].length * TILE_SIZE, 0,
                 SIDEBAR_WIDTH * TILE_SIZE, board.length * TILE_SIZE);
    ctx.font = `${0.75 * TILE_SIZE}px Noto Sans`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgb(${COLORS.sidebartext})`;
    let x = TILE_SIZE * (board[0].length + 0.5);
    for (let i = 0; i < mineTypes.length; i++) {
        let mt = mineTypes[i];
        let y = TILE_SIZE * (i + 0.5);
        ctx.drawImage(IMAGES.tile, x, y, TILE_SIZE, TILE_SIZE);
        let img = IMAGES[`flag${mt}`];
        if (img) ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillText(`${flagCounts[mt] ?? 0} / ${mineCounts[mt]}`, x + TILE_SIZE * 1.25, y + TILE_SIZE / 2);
    }
}

function getImages(tile) {
    if (isGameOver) {
        if (!tile.opened) {
            if (tile.flags && !tile.mines)
                return ["tile", "flag" + tile.flags, "x"];
            if (tile.flags !== tile.mines)
                return ["tile", "mine" + tile.mines];
        } else if (tile.mines)
            return ["redtile", "mine" + tile.mines];
    }
    if (tile.flags)
        return ["tile", "flag" + tile.flags];
    if (!tile.opened)
        return ["tile"];
    if (tile.clue === null)
        return ["clicked"];
    return ["clicked", "num" + tile.clue];
}

function getColor(r, c) {
    if (isWin) return COLORS.win;
    if (isGameOver) return COLORS.gameOver;
    if (!mouse) return;
    if (mouse.r === r && mouse.c === c) return COLORS.hover;
    for (let neighbor of getNeighbors(mouse.r, mouse.c)) {
        if (neighbor.r === r && neighbor.c === c) return COLORS.neighbor;
    }
}

function openCell(r1, c1) {
    let queue = [{r: r1, c: c1}];
    let processed = [];
    while (queue.length) {
        let {r, c} = queue.shift();
        if (processed.some(({r: tr, c: tc}) => tr === r && tc === c)) continue;
        processed.push({r: r, c: c});
        let tile = board[r][c];
        if (!tile) continue;
        if (tile.flags) continue;
        if (tile.mines) {
            isGameOver = true;
            if (insaneMode) {
                alert("Crazy?");
                alert("I was crazy once.");
                alert("They locked me in a room.");
                alert("A rubber room.");
                alert("A rubber room with rats.");
                alert("The rats made me crazy.");
            }
        }
        let wasOpened = tile.opened;
        tile.opened = true;
        if (wasOpened && r === r1 && c === c1) {
            let flagTotal = 0;
            for (let neighbor of getNeighbors(r, c)) {
                if (isInBounds(neighbor)) {
                    flagTotal += board[neighbor.r][neighbor.c].flags;
                }
            }
            if (flagTotal === tile.clue) {
                for (let neighbor of getNeighbors(r, c)) {
                    if (isInBounds(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
        } else if (tile.clue === null && !tile.mines) {
            for (let neighbor of getNeighbors(r, c)) {
                if (isInBounds(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }
    }
    if (board.every(r => r.every(x => x.opened === !x.mines))) {
        isWin = true;
        isGameOver = true;
    }
    drawBoard();
}

function flagCell(r, c) {
    if (!board[r][c]) return;
    if (board[r][c].opened) return;
    let mineTypesOnBoard = new Set();
    for (let br = 0; br < board.length; br++) {
        for (let bc = 0; bc < board[br].length; bc++) {
            mineTypesOnBoard.add(board[br][bc].mines);
        }
    }
    let flagTypes = FLAG_TYPES.filter(x => mineTypesOnBoard.has(x));
    let flagType = board[r][c].flags;
    let idx = (flagTypes.indexOf(flagType) + 1) % flagTypes.length;
    board[r][c].flags = flagTypes[idx];
    drawBoard();
}

canvas.addEventListener("mousedown", function (event) {
    event.preventDefault();
    if (isGameOver) return;
    let rect = event.target.getBoundingClientRect();
    let x = event.x - rect.left;
    let y = event.y - rect.top;
    let r = Math.floor(y / TILE_SIZE);
    let c = Math.floor(x / TILE_SIZE);
    if (event.button === 0)
        openCell(r, c);
    else if (event.button === 2)
        flagCell(r, c);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault() || false);

function newGame() {
    isGameOver = false;
    isWin = false;
    updateCanvasSize();
    createBoard();
    drawBoard();
}

newGame();

let currentCode = "";
let timeoutId;

function showOverlayText(text, opacity) {
    let overlay = document.getElementById("overlay");
    overlay.innerText = text;
    overlay.style.color = `rgba(255, 255, 255, ${opacity})`;
}

function flashOverlayText(text, opacity, deltaOpacity, deltaTime) {
    showOverlayText(text, opacity);
    if (opacity <= 0) return;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
        flashOverlayText(text, opacity - deltaOpacity, deltaOpacity, deltaTime);
    }, deltaTime);
}

document.addEventListener("keydown", function (e) {
    if (document.activeElement.tagName === "INPUT") return;
    if (e.key.length === 1) {
        currentCode += e.key.toUpperCase();
        flashOverlayText(currentCode, 0.75, 0.01, 1);
    } else if (e.key === "Enter") {
        submitCode(currentCode);
        currentCode = "";
    }
});

let insaneMode = false;
function submitCode(code) {
    if (code === "CIWCO") {
        insaneMode = !insaneMode;
        flashOverlayText("Insane mode " + (insaneMode ? "enabled" : "disabled"),
                         1, 0.01, 1);
    } else {
        flashOverlayText("Unknown code.", 1, 0.01, 1);
    }
}