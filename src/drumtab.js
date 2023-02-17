let midi= {
    NOTE_ON: 9,
    NOTE_OFF: 8,
    NOTE_NAMES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    DRUMS: {
        snare: {
            short: "SN",
            aliases: ["S"],
            long: "snare",
            midi: "C#2",
            midiAliases: ["D2"],
            stave: "c"
        }, 
        bass: {
            short: "BD",
            aliases: ["B", "K", "KD"],
            long: "bass",
            midi: "C2",
            midiAliases: [],
            stave: "F"
        },
        hihat: {
            short: "HH",
            aliases: ["H"],
            long: "closed hi hat",
            midi: "F#2",
            midiAliases: ["A#2", A#0],
            stave: "ng"
        },
        floortom: {
            short: "FT",
            aliases: ["F", "T3"],
            long: "floor tom",
            midi: "G2",
            midiAliases: ["A#3"],
            stave: "A"
        },
        tom1: {
            short: "T1",
            aliases: ["T", "HT"],
            long: "high tom",
            midi: "C3",
            midiAliases: ["D3"],
            stave: "e"
        },
        tom2: {
            short: "T2",
            aliases: ["LT"],
            long: "low tom",
            midi: "A2",
            midiAliases: ["B2"],
            stave: "d"
        },
        ride: {
            short: "RD",
            aliases: ["RC", "RD", "R"],
            long: "ride",
            midi: "B3",
            midiAliases: ["D#3", "F3"],
            stave: "nf"
        },
        crash: {
            short: "CC",
            aliases: ["C", "C1", "CR"],
            long: "crash cymbal",
            midi: "A3",
            midiAliases: ["C#3", "G3", "E3"],
            stave: "na"
        },
        hihatpedal: {
            short: "HF",
            aliases: ["HHF", "FH"],
            long: "hi hat foot",
            midi: "G#2",
            midiAliases: [],
            stave: "nD"
        },
    },

    lookupMidi: (note) => {
        let d = {};
        Object.keys(midi.DRUMS).forEach(key => {
            if(midi.DRUMS[key].midi == note || midi.DRUMS[key].midiAliases.includes(note)) {
                d = midi.DRUMS[key];
            }
        });
        return d;
    },

    lookup: (alias) => {
        let instrument = {};
        Object.keys(midi.DRUMS).forEach(key => {
            if(midi.DRUMS[key].short == alias || midi.DRUMS[key].aliases.includes(alias)) {
                instrument = midi.DRUMS[key];
            }
        });
        return instrument;
    },

    note2name: (note) => {
        let name = midi.NOTE_NAMES[note % 12];
        let octave = Math.floor(note / 12) - 1;
        return name + octave;
    },

    name2note: (name) => {
        for(let i = 0; i < 12; i++) {
            if(name.includes(midi.NOTE_NAMES[i])){
                break;
            }
        }
        let oct = parseInt(name.replace(/[A-Ga-g]/,"")) + 1;
        return oct*12+i;

    },

    process: (data) => {
        m = {
            message: (data[0] >> 4 ) & 0xF,
            channel: data[0] & 0xF,
            key: data[1],
            name: midi.note2name(data[1]),
            velocity: data[1],
            data: data
        };
        return m;
    }
}
var drumtab = {};

drumtab.voicingOptions = [
    {
        name: "Single voice",
        names: ["Single voice"],
        voices: [["CC", "HH", "RD", "SN", "T1", "T2", "FT", "BD", "HF"]]
    },
    {
        name: "Hands and feet",
        names: ["Hands", "Feet"],
        voices: [
            ["CC", "HH", "RD", "SN", "T1", "T2", "FT"],
            ["BD", "HF"]
        ],
    },
    {
        name: "Cymbals and drums",
        names: ["Cymbals", "Drums"],
        voices: [
            ["CC", "HH", "RD", "HF"],
            ["SN", "T1", "T2", "FT", "BD"]
        ]
    }
];

drumtab.save = () => {
    let s = JSON.stringify(drumtab.options);
    let compressed = LZString.compressToEncodedURIComponent (s);
    window.location = "index.html?t=" + compressed;
}

drumtab.load = () => {
    const query = window.location.search;
    const params = new URLSearchParams(query);
    const compressed = params.get('t');
    let options = {
        tab: `HH|x-x-x-x-x-x-x-x-|
 S|----o-------o---|
 B|O-------o-------|
  1 + 2 + 3 + 4 +`,
        voicing: 1,
        repeat: 16,
        speedup: false,
        bpm: 60
    }
    try {
        let s = LZString.decompressFromEncodedURIComponent(compressed);
        options = JSON.parse(s);
    } catch (error){
        console.log("Invalid url - setting default options");
    }
    drumtab.options = options;
    
    return options;
}


drumtab.init = (kitid) => {
    const canvas = document.getElementById(kitid);
    let config = {
        width: 600,
        height: 600,
        type: Phaser.WEBGL,
        parent: kitid,
        scene: {
            preload: function()  {
                kit.sounds = [];
                Object.keys(kit.zones).forEach((zone) => {
                    this.load.audio(zone, [`media/${kit.name}/${kit.zones[zone].sound}`]);
                });
                this.load.image('kit', `media/${kit.name}/${kit.imageURL}`);
                this.load.bitmapFont('font', 'media/font.png', 'media/font.xml');
            },

            create: function() {
                this.add.image(0, 0, 'kit').setOrigin(0,0);
                Object.keys(kit.zones).forEach((zone) => {
                    kit.sounds[zone] = this.sound.add(zone);
                });
                
                kit.text = new Phaser.GameObjects.BitmapText(this, 500, 50, 'font', "");
                this.add.existing(kit.text);
                kit.shapes = {
                    played: {}, // playback
                    hit: {}     // user hit
                };
                kit.g = this.add.graphics();

                Object.keys(kit.zones).forEach((zone) => {
                    let s = kit.zones[zone];
                    let e = new Phaser.GameObjects.Ellipse(this, s.x + (s.w / 2), s.y + (s.h / 2), s.w, s.h, 0x00FF00);
                    e.rotation = s.angle;
                    kit.shapes['hit'][zone] = e;
                    e.alpha = 0;
                    this.add.existing(e);

                    e = new Phaser.GameObjects.Ellipse(this, s.x + (s.w / 2), s.y + (s.h / 2), s.w, s.h, s.colour);
                    e.rotation = s.angle;
                    e.isStroked = true;
                    e.lineWidth = 5;
                    e.strokeColor = 0xFF0000;
                    kit.shapes['played'][zone] = e;
                    this.add.existing(e);
                    e.setInteractive();
                    e.zone = zone;
                    e.on('pointerdown', function(p) {
                        drumtab.onHit(this.zone);
                    });
                });
            },

            update: function() {
                Object.keys(kit.zones).forEach((zone) => {
                    kit.shapes['played'][zone].alpha *= 0.8;
                    kit.shapes['hit'][zone].alpha *= 0.8;
                });
            }
        }
    }
    let game = new Phaser.Game(config);

    // set up audio
    /// TODO:

    // set up midi
    WebMidi.enable().then(()=> {
        WebMidi.inputs.forEach((device, index) => {
            console.log(index, device.manufacturer, device.name);
            device.addListener("noteon", (e) => {
                //console.log(e, e.note.name, e.note.number, e.note.accidental);
                let m = e.note.name + (e.note.accidental?e.note.accidental:"") + (e.note.octave);
                let hit = midi.lookupMidi(m);
                let parts = {};
                parts[hit.short] = "1";
                if(hit.short) {
                    drumtab.onHit(hit.short, e.rawVelocity)
                } else {
                    console.log("Unknown midi key: ", m);
                }

            }, {
                channels: [10]
            });
        });
    }).catch((e) => {
        console.error(e);
    });
}

drumtab.onHit = function(drum, volume) {
    kit.shapes['hit'][drum].alpha = 1;

    if(drumtab.playback) {
        let d = drumtab.getPosition(drumtab.playback.currentBeat);
        d.time = drumtab.playback.currentTime;
        
        drumtab.analysis[drum].played.push(d);
    }
}

drumtab.ANALYSIS_THRESHOLD_ON_TIME = 50; // 50ms before a hit is early or late
drumtab.ANALYSIS_THRESHOLD_MISS = 100; // 50ms before a hit is early or late

drumtab.analyse = () => {
    if(!drumtab.analysis)
        return;
    let summary = {
        total: 0,
        good: 0,
        early: 0,
        late: 0
    }
    kit.g.clear()
    Object.keys(kit.zones).forEach((zone, index) => {
        let z = drumtab.analysis[zone];
        z.miss = 0;
        z.early = 0;
        z.late = 0;
        z.total = 0;
        z.good = 0;
        for(let i = 0; i < z.expected.length; i++) {
            let t = z.expected[i].time;
            z.expected[i].status = "miss";
            let miss = true;
            z.total++;
            summary.total++;
            for(let j = 0; j < z.played.length; j++) {
                let delta = z.played[j].time - z.expected[i].time;
                if(Math.abs(delta) < drumtab.ANALYSIS_THRESHOLD_MISS) {
                    miss = false;
                    if(Math.abs(delta) < drumtab.ANALYSIS_THRESHOLD_ON_TIME) {
                        z.expected[i].status = "on time";
                        z.good++;
                        z.expected[i].delta = delta;
                        summary.good++;
                        break;
                    } else {
                        z.expected[i].status = delta < 0? "early":"late";
                        if(delta < 0) {
                            z.early++;
                            summary.early++;
                        } else {
                            z.late++;
                            summary.late++;
                        }
                        break;
                    }
                }
            }
            if(miss) {
                z.miss++;
            }
        }

        let s = kit.zones[zone];

        if(z.total > 0 && z.played.length > 0) {
            // misses
            kit.g.fillStyle(0xff0000, 1);
            kit.g.fillRoundedRect(s.x + (s.w/2) - 50, s.y + s.h + 10, 100, 10, 5);

            // on time
            let w1 = ((z.good + z.early + z.late) / z.total) * 100;
            kit.g.fillStyle(0x00ff00, 1);
            kit.g.fillRoundedRect(s.x + (s.w/2) - (w1 / 2), s.y + s.h + 10, w1, 10, 5);

            // early
            w = (z.early / z.total) * 50;
            kit.g.fillStyle(0xeeee00, 1);
            kit.g.fillRoundedRect(s.x + (s.w/2) - (w1 / 2), s.y + s.h + 10, w, 10, 5);

            // late
            w = (z.late / z.total) * 50;
            kit.g.fillStyle(0xeeee00, 1);
            kit.g.fillRoundedRect(s.x + (s.w/2) + (w1 / 2) - w, s.y + s.h + 10, w, 10, 5);
        }
    });
    summary.percent = Math.round(summary.good / summary.total * 100);
    $('#score-bar').css({
        opacity:1,
        height:summary.percent + '%'
    });
    $('#score-bar-outer').css({
        opacity:1
    });
    $('#score-percent').css({
        opacity:1
    }).text(summary.percent);
    console.log(summary);
}

drumtab.restartAnalysis = () => {
    if(drumtab.analysis) {
        drumtab.analyse();
    }
    drumtab.analysis = {
    }

    Object.keys(kit.zones).forEach((zone, index) => {
        drumtab.analysis[zone] = {
            expected: [],
            played: [],
            miss: 0,
            early: 0,
            late: 0,
            total: 0,
            good: 0
        }
    });
}

drumtab.step = (progress) => {
    if(!progress) {
        progress = {
            bar: 0, // bar starting from 0
            note: 0, // index of note within bar (not beat)
            beat: 0
        }
    }
    $('.abcjs-note').removeClass('selected');

    let bar = drumtab.drums.bars[progress.bar];
    if(bar && bar.all) {
        let noteCount = 0;
        for(progress.beat = 0; progress.beat < bar.notes; progress.beat++) {
            if(bar.all[progress.beat]) {
                if(noteCount == progress.note) {
                    //console.log(progress, bar.all[progress.beat]);
                    kit.draw(bar.all[progress.beat]);
                    $(`.abcjs-n${progress.note}.abcjs-mm${progress.bar}.abcjs-v0`).addClass('selected');
                    progress.note++;
                    return progress;
                } else {
                    noteCount++;
                }
            }
        }
    }



}

drumtab.playnote = (note) => {
    WebMidi.outputs.forEach((device, index) => {
        let channel = device.channels[10];
        channel.playNote(note);
    });
}

drumtab.timeSignature = [4,4];

kit.draw = (parts, played) => {
    if(parts) {
        Object.keys(parts).forEach((zone) => {
            kit.shapes['played'][zone].alpha = 1;
        });
    }

    // show timings
    if(drumtab.playback) {
        let d = drumtab.getPosition(drumtab.playback.currentBeat);
        kit.text.text = `${drumtab.repeatCount}:${1 + d.bar}:${d.count}`;
    }

}

drumtab.Note2ABC = (tabChar, instrument, duration, preChord=false) => {
    // sometimes (e.g. flams) there's part of the ABC notation which needs to be written before a chord []
    if(preChord) {
        return ((tabChar.toUpperCase() == tabChar && tabChar != "#")?"!^!":"") + // Accent
        (tabChar == "#"?"!breath!":"") +  // choke
        (tabChar.toLowerCase() == "s"?'"splash"': "") + // splash
        (tabChar.toLowerCase() == "c"?'"china"': "") + // china
        (tabChar.toLowerCase() == "g"?'"<("">)"':'') + // ghost note
        (tabChar.toLowerCase() == "l"?'"L"': '') + // Left hand sticking
        (tabChar.toLowerCase() == "r"?'"R"': '') + // Left hand sticking
        
        (tabChar.toLowerCase() == "f"? // flam
            '{' + instrument.stave +  
            (duration>1?duration:"") + 
            '}'
        :'') +

        ((tabChar.toLowerCase() == "b" && instrument.long != "ride")? "~":"") + 
        
        (tabChar.toLowerCase() == "d"? // drag
            '{' + instrument.stave +
            (duration>1?duration:"") +
            instrument.stave + 
            (duration>1?duration:"") + 
            '}'
        :'');
    }
    if(instrument.long == "ride") {
        instrument.stave = tabChar.toUpperCase() == "B"? "mf":"nf";
    } 
    if(instrument.long == "crash cymbal") {
        switch(tabChar.toLowerCase()) {
            case 's': // splash
                instrument.stave = 'mb';    
                break;
            case 'c': // china
                instrument.stave = 'nb';
                break;
            default: // crash
                instrument.stave = "na";
                break;
        } 
    }
    return instrument.stave + 
    (duration>1?duration:"")
}

drumtab.selectedNotes = [];
drumtab.playing = false;
drumtab.pause = () => {
    drumtab.playback.pause();
    drumtab.playing  = false;
}
drumtab.repeatCount = 1;
drumtab.repeatTotal = 1;

drumtab.updateScore = (id, abc) => {
    score = ABCJS.renderAbc(id, abc, {
        add_classes: true,
        clickListener: (element, tuneNumber, classes, analysis, drag, mouseevent) => {
            let bar = analysis.measure;
            for(let i = 0; i < analysis.line; i++) {
                bar += drumtab.drums.lines[i];
            }
            let beat = bar * drumtab.drums.beats;
            let m = classes.match(/abcjs-v(\d+) abcjs-n(\d+)/);
            if(m) {
                let n = {
                    bar: bar,
                    voiceId: parseInt(m[1]),
                    noteId: parseInt(m[2])
                }
                n.notes = drumtab.drums.bars[n.bar].voicing[drumtab.drums.voices[n.voiceId]].beats;
                let noteCount = 0;
                for(let i = 0; i < drumtab.drums.beats; i++) {
                    if(n.notes[i]) {
                        noteCount++;
                        if(noteCount > n.noteId) {
                            n.beat = i;
                            break;
                        }
                    }
                }
                beat += n.beat;
                let notes = drumtab.drums.bars[bar].voicing[drumtab.drums.voices[n.voiceId]].beats[beat % drumtab.drums.beats];
                let selected = {

                }
                notes.forEach((note) => {
                    selected[note.instrument] = note.style;
                });
                kit.draw(selected);
            }
            drumtab.startFrom = beat * 4 / drumtab.drums.beats;
            if(drumtab.playback) {
                drumtab.playback.setProgress(drumtab.startFrom, "beats");
            }
            
        }
    })[0];

}

drumtab.startFrom = 0;

drumtab.getPosition = (currentBeat) => {
    let beatsInBar = drumtab.drums.beats * 2;
    let bar = Math.floor(currentBeat / (beatsInBar));
    let beat = ((currentBeat) % (beatsInBar)) / 2;
    let d = {
        beat: beat,
        bar: bar,
        c: currentBeat,
        count: 1 + Math.floor(drumtab.timeSignature[0] * (currentBeat % beatsInBar) / beatsInBar)
    }
    return d;
}

drumtab.play = (repeatCount, done) => {
    drumtab.restartAnalysis();
    drumtab.repeatCount = 1;
    drumtab.options.repeat = repeatCount;
    drumtab.repeatTotal = repeatCount;    
    if(!drumtab.playback) {
        drumtab.playback = new ABCJS.TimingCallbacks(score, {
            eventCallback: (e) => {
                // clear all selected notes
                while(drumtab.selectedNotes.length > 0) {
                    let n = drumtab.selectedNotes.pop();
                    n.classList.remove('selected');
                }

                // select current note
                if(e) {
                    for(let i = 0; i < e.elements.length; i++) {
                        if(e.elements[i][0]) {
                            e.elements[i][0].classList.add("selected");
                            drumtab.selectedNotes.push(e.elements[i][0]);
                        }
                    }
                }
            },
            beatCallback: (e) => {
                if(drumtab.playback.currentBeat % 2 == 1) {
                    // all sounds off
                    kit.draw();
                } else {
                    drumtab.startFrom = 0;
                    // some sounds might be on
                    let d = drumtab.getPosition(drumtab.playback.currentBeat);
                    d.repeat = repeatCount;
                    if(drumtab.drums.bars[d.bar] && drumtab.drums.bars[d.bar].all[d.beat]) {
                        d.notes = drumtab.drums.bars[d.bar].all[d.beat];
                        kit.draw(drumtab.drums.bars[d.bar].all[d.beat]);
                        // play midi notes
                        if(drumtab.options.midi) {
                            Object.keys(d.notes).forEach((key) => {
                                let note = midi.lookup(key);
                                drumtab.playnote(note.midi);
                            });
                        }
                        // play audio notes
                        if(drumtab.options.audio) 
                        {
                            Object.keys(d.notes).forEach((key) => {
                                let accent = d.notes[key] == d.notes[key].toUpperCase();
                                kit.sounds[key].volume = accent?1:0.2;
                                kit.sounds[key].stop();
                                kit.sounds[key].play();
                            });
                        }

                        // log expected notes
                        Object.keys(d.notes).forEach((key) => {
                            let accent = d.notes[key] == d.notes[key].toUpperCase();
                            let hit = drumtab.getPosition(drumtab.playback.currentBeat);
                            hit.time = drumtab.playback.currentTime;
                            drumtab.analysis[key].expected.push(hit);
                        });
                    } 
                    //console.log(d);
                    
                    if(drumtab.playback.currentBeat == drumtab.playback.totalBeats) {
                        if(done) {
                            drumtab.playing = false;
                            drumtab.playback = undefined;
                            if(drumtab.repeatCount < drumtab.repeatTotal) {
                                let r = drumtab.repeatCount;
                                console.log(`repeat ${drumtab.repeatCount} / ${drumtab.repeatTotal}`);
                                drumtab.play(repeatCount, done);
                                drumtab.repeatCount = r+1;
                            } else {
                                if(drumtab.options.speedup) {
                                    console.log("Speeding up");
                                    drumtab.options.bpm += 10;
                                    
                                    if(drumtab.options.bpm > 120) {
                                        drumtab.options.bpm = 120;
                                        console.log("done speed up");
                                        done();
                                    } else {
                                        let r = drumtab.repeatCount;
                                        drumtab.repeatCount = 0;
                                        console.log(`repeat ${drumtab.repeatCount} / ${drumtab.repeatTotal}`);
                                        drumtab.play(repeatCount, done);
                                    }
                                    if(updateBPM) updateBPM();
                                } else {
                                    console.log("done repeating");
                                    done();
                                }
                            }
                        }
                    }
                }
                
            },
            qpm: drumtab.options.bpm,
            beatSubdivisions: drumtab.drums.beats / 2
        });
    }
    drumtab.playback.done = done;
    drumtab.playing = true;
    drumtab.playback.start();
    if(drumtab.startFrom > 0) {
        drumtab.playback.setProgress(drumtab.startFrom, "beats");
    }
    
}

drumtab.setBPM = (bpm) => {
    if(drumtab.playing) {
        let beats = drumtab.playback.currentBeat;
        let done = drumtab.playback.done;
        drumtab.playback.stop();
        drumtab.playing = false;
        drumtab.playback = undefined;
        drumtab.play(drumtab.repeatTotal, done);
        drumtab.playback.setProgress(beats / 2, "beats");
    }
}

drumtab.options = {
    tab: "",
    voicing: 1,
    bpm: 60,
    repeat: 16,
    speedup: false
}

drumtab.Tab2ABC = (tab, voicingIndex) => {
    drumtab.options.tab = tab;
    if(voicingIndex === undefined) {
        voicingIndex = drumtab.options.voicing;
    }
    let voicing = drumtab.voicingOptions[voicingIndex];
    drumtab.options.voicing = voicingIndex;
    let startBar = 0;
    let lines = tab.split("\n");
    let drums = {
        bars: [],
        lines: [],
        voices: voicing.names
    }
    let text = "";
    let lineCount = 0;
    let newPart = false;

    // go through each line of tab
    for(let i = 0; i < lines.length; i++) {        
        // detect time signature
        m = lines[i].match(/(\d+)\/(\d)+$/);
        if(m) {
            drumtab.timeSignature = [parseInt(m[1]), parseInt(m[2])];
            continue;
        }
        
        m = lines[i].match(/^\s*$/);
        if(m) {
            newPart = true;
            startBar = drums.bars.length;
        }

        // extract part names
        m = lines[i].match(/^\s*([A-Za-z0-9]+)\s*:?\s*\|/);
        if(m) {
            let instrument = midi.lookup(m[1]);
            let voice = {
                instrument: instrument.short,
                bars: []
            }

            // iterate through each bar
            let bars = lines[i].split("|").slice(1);
            for(let j = 0; j < bars.length; j++) {
                let bar = bars[j].trim();
                if(bar.length > 0) {
                    voice.bars[j + startBar] = bar;
                    
                    // store bar for all parts
                    while(drums.bars.length < startBar + bars.length - 1) {
                        let newBar = {
                            parts: {},
                            notes: bar.length,
                            skip: 0,
                            all: {},
                            sounds: {},
                            voicing: {},
                            before: "",
                            after: ""
                        }
                        for(let k = 0; k < voicing.names.length; k++) {
                            newBar.voicing[voicing.names[k]] = {
                                beats: {},
                                parts: {},
                                abc: ""
                            };
                        }
                        drums.bars.push(newBar);
                    }
                    if(newPart && j == 0) {
                        drums.lines[lineCount] = bars.length - 1;
                        drums.bars[j + startBar].before = "\n";
                        lineCount++;
                    }

                    if(text.length > 0) {
                        drums.bars[startBar].before += '"' + text + '"';
                        text = "";
                    }
                    
                    // iterate through each note in the bar
                    for(let k = 0; k < bar.length; k++) {
                        if(bar[k] != "-") {
                            let duration = 1;
                            for(let lookAhead = k + 1; lookAhead < bar.length; lookAhead++) {
                                if(bar[lookAhead] == '-') {
                                    duration++;
                                } else {
                                    break;
                                }
                            }
                            if(drums.bars[j + startBar].all[k] === undefined) {
                                drums.bars[j + startBar].all[k] = {};
                            }
                            
                            drums.bars[j + startBar].all[k][voice.instrument] = bar[k];
                            
                            // split into different stave voices
                            for(let l = 0; l < voicing.voices.length; l++) {
                                if(voicing.voices[l].includes(voice.instrument)) {
                                    if(drums.bars[j + startBar].voicing[voicing.names[l]].parts[voice.instrument] === undefined) {
                                        drums.bars[j + startBar].voicing[voicing.names[l]].parts[voice.instrument] = {};
                                    }
                                    drums.bars[j + startBar].voicing[voicing.names[l]].parts[voice.instrument][k] = bar[k];
                                    if(drums.bars[j + startBar].voicing[voicing.names[l]].beats[k] === undefined) {
                                        drums.bars[j + startBar].voicing[voicing.names[l]].beats[k] = [];
                                    }
                                    let note = {};
                                    note = {
                                        instrument: voice.instrument,
                                        style: bar[k],
                                        duration: duration,
                                        abc: drumtab.Note2ABC(bar[k], instrument, duration)
                                    }
                                    drums.bars[j + startBar].voicing[voicing.names[l]].beats[k].push(note);
                                }
                            }
                        }
                    }                        
                    drums.bars[j + startBar].parts[voice.instrument] = voice.bars[j];
                    drums.lines[lineCount] = bars.length - 1;
                }
            }
            newPart = false;
        } else {
            text = lines[i];
        }
    }
    

    // get max number of beats in a bar
    drums.beats = 1;
    for(let i = 0; i < drums.bars.length; i++) {
        if(drums.bars[i].notes > drums.beats) {
            drums.beats = drums.bars[i].notes;
        }
    }
    drumtab.drums = drums;

    let abc = "X: 1\n" +
    `M: ${drumtab.timeSignature[0]}/${drumtab.timeSignature[1]}\n` +
    "L: 1/" + (drums.beats  * drumtab.timeSignature[1] / drumtab.timeSignature[0]) + "\n" +
    "U:n=!style=x!\n" +
    "U:m=!style=harmonic!\n" +
    "K:perc\n" +
    "%%stretchlast\n"
    if(text.length > 0) {
        abc += '"' + text + '"';
    }

    for(let i = 0; i < drums.bars.length; i++) {
        abc += drums.bars[i].before;

        // check if bar is empty
        if(Object.keys(drums.bars[i].all).length == 0) {
            abc += `z${drums.beats}`
        } 

        // bar is not empty
        else {
            let voiceCount = Object.keys(drums.bars[i].voicing).length;
            let currentVoice = 0;
            for(const [voiceName, v] of Object.entries(drums.bars[i].voicing)) {
                let beatCount = 0;

                let firstBeat = 0;
                for(let j = 0; j < drums.beats; j++) {
                    if(v.beats[j] !== undefined) {
                        firstBeat = j;
                        beatCount = j;
                        break;
                    }
                }
                if(firstBeat > 0) {
                    abc += `z${firstBeat}`;
                }
                
                for(let [beat, notes] of Object.entries(v.beats)) {
                    beat = parseInt(beat);
                    
                    // merging notes from multiple instruments into a single voice may mean durations for some notes need shortening
                    let duration = drums.beats - beat;
                    for(let j = beat + 1; j < drums.beats; j++) {
                        if(v.beats[j] !== undefined) {
                            duration = j - beat;
                            break;
                        }
                    }
                    for(let j = 0; j < notes.length; j++) {                      
                        notes[j].duration = duration;
                    }

                    for(let j = 0; j < notes.length; j++) {
                        abc += drumtab.Note2ABC(notes[j].style, midi.lookup(notes[j].instrument), duration, true);
                    }
                    
                    // start a chord if necessary
                    if(notes.length > 1) {
                        abc += "[";
                    }  

                    for(let j = 0; j < notes.length; j++) {
                        // reset duration of all notes to minimum duration
                        notes[j].duration = duration;
                        notes[j].abc = drumtab.Note2ABC(notes[j].style, midi.lookup(notes[j].instrument), duration);
                        abc += notes[j].abc;
                    }

                    // end a chord if necessary
                    if(notes.length > 1) {
                        abc += "]";
                        
                    }
                    beatCount += duration;
                    if(beatCount % (drumtab.drums.beats * 2/ drumtab.timeSignature[0]) == 0) {
                        abc += " ";
                    }
                }
                currentVoice++;
                if(currentVoice < voiceCount) {
                    abc += "&\\";                    
                } else {
                    abc += " ";
                }
                
                
            }
        }
        abc += drums.bars[i].after;
        abc += "|"; 
    }

    return abc;
}
