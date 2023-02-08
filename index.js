import { el } from '@elemaudio/core';
import { default as core } from '@elemaudio/node-renderer';
import ca from './cellauto.cjs';
import chalk from 'chalk';
import teoria from 'teoria';

let activation = function(x) {
    //return -1/(0.89*Math.pow(x, 2)+1)+1;
    return x;
    //return (x==3 || x==11 || x==12) ? 1 : 0;

}
let kernel = [[0.8, -0.85, 0.8], [-0.85, -0.2, -0.85], [0.8, -0.85, 0.8]];
//let kernel = [[0.096, 0.338, -0.643], [0.253, -0.271, -0.602], [-0.665, 0.797, 0.721]];
//let kernel = [[1, 1, 1], [1, 9, 1], [1, 1, 1]];
let columnNumber = 8, rowNumber = 8;

class MainLayer {

    constructor() {
        this.initiate();
        this.currentStep = 0;
    }

    initiate() {
        this.populateCellGrid()
    }

    update(log = false) {
        for (let i = 0; i < rowNumber; i++) {
            let t = [];
            for (let j = 0; j < columnNumber; j++) {
                let v = this.updateCellMatrix(i, j, columnNumber, rowNumber, this.cells, kernel);
                v = v > 1 ? 1 : v < 0 ? 0 : v;
                this.cells[i][j] = v;
                if (log) {
                    let c = chalk.black(v);
                    if (v > 0 && v < 0.1) {
                        c = chalk.red(v);
                    } else if (v >= 0.1) {
                        c = chalk.green(v);
                    }
                    t.push(c);
                }
            }
            if (log) {
                console.log(t.join(chalk.blue('|')));
            }
        }
        if (log) {
            console.log('+++++++++++++++++');
        }
    }

    step(log = false) {
        this.currentStep++;
        if (this.currentStep === columnNumber) {
            this.currentStep = 0;
            this.update(log);
        }
    }

    row(y) {
        return this.cells[y].map(c => c);
    }

    out(y) {
        return this.cells[y][this.currentStep];
    }

    populateCellGrid() {
        this.cells = [];
        for (let i = 0; i < rowNumber; i++) {
            this.cells[i] = []
            for (let j = 0; j < columnNumber; j++) {
                this.cells[i].push(Math.random());
            }
        }
    }

    updateCellMatrix(y, x, columnNumber, rowNumber, cellMatrix, kernelValues) {
        let yMinusOne = y == 0 ? rowNumber - 1 : y - 1;
        let yPlusOne = y == rowNumber - 1 ? 0 : y + 1;
        let xMinusOne = x == 0 ? columnNumber - 1 : x - 1;
        let xPlusOne = x == columnNumber - 1 ? 0 : x + 1;

        let updatedValue = cellMatrix[y][x] * kernelValues[1][1]
            + cellMatrix[yMinusOne][x] * kernelValues[0][1]
            + cellMatrix[y][xMinusOne] * kernelValues[1][0]
            + cellMatrix[yMinusOne][xMinusOne] * kernelValues[0][0]
            + cellMatrix[yPlusOne][x] * kernelValues[2][1]
            + cellMatrix[y][xPlusOne] * kernelValues[1][2]
            + cellMatrix[yPlusOne][xPlusOne] * kernelValues[2][2]
            + cellMatrix[yMinusOne][xPlusOne] * kernelValues[0][2]
            + cellMatrix[yPlusOne][xMinusOne] * kernelValues[2][0];

        return activation(updatedValue)
    }
}

const layers = [new MainLayer()];
const rates = [1, 0.75, 0.5, 0.25];
const bpm = 120;
const rate = 60000 / bpm;

let baseNote = teoria.note.fromKey(12 + Math.round(Math.random() * 24));
let accentNote = teoria.note.fromKey(baseNote.key() + 12);
let scaleType = ['major', 'minor', 'lydian', 'mixolydian', 'phrygian'][Math.round(Math.random() * 3)];
let scale = accentNote.scale(scaleType).notes().concat(baseNote.scale(scaleType).notes());

core.on('load', () => {
    let newKernel = [[],[],[]];
    for (let i=0; i<3; i++) {
        for (let j=0; j<3; j++) {
            kernel[i][j] = Math.random() * 2 - 1;
        }
    }

    layers.forEach((layer, i) => {
        setInterval(() => {
            //let r = rates[Math.floor(layer.out(2) * (rates.length - 1))];
            let r = rates[2];
            let gate = el.metro({ interval: Math.floor(rate * r), name: i });
            let notes = layer.row(0).map(function (v) {
                return scale[Math.floor(v * (scale.length - 1))].fq();
            });
            let noteSeq = el.seq({ key: 'n' + i, seq: notes, hold: true }, gate, 0);
            let gates = layer.row(1);
            let gateSeq = el.seq({ key: 'g' + i, seq: gates, hold: true }, gate, 0);
            let adsr = el.select(
                el.ge(gateSeq, 0),
                el.adsr(0.01, rate, gateSeq, 0.1, gate),
                el.smooth(el.tau2pole(0.02), el.const({ value: 0 }))
            )
            let o = el.mul(
                el.cycle(noteSeq),
                adsr
            );
            let out = el.mul(o, 0.1);
            core.render(out, out);
        }, 5);
    });
});

core.on('metro', function (e) {
    layers[e.source].step(true);
});

core.initialize();