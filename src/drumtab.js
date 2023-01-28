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
            stave: "c"
        }, 
        bass: {
            short: "BD",
            aliases: ["B", "K", "KD"],
            long: "bass",
            midi: "C2",
            stave: "F"
        },
        hihat: {
            short: "HH",
            aliases: ["H"],
            long: "closed hi hat",
            midi: "F#2",
            stave: "ng"
        },
        floortom: {
            short: "FT",
            aliases: ["F", "T3"],
            long: "floor tom",
            midi: "G2",
            stave: "A"
        },
        tom1: {
            short: "T1",
            aliases: ["T", "HT"],
            long: "high tom",
            midi: "C3",
            stave: "e"
        },
        tom2: {
            short: "T2",
            aliases: ["LT"],
            long: "low tom",
            midi: "A2",
            stave: "d"
        },
        ride: {
            short: "RD",
            aliases: ["RC", "RD", "R"],
            long: "ride",
            midi: "B3",
            stave: "nf"
        },
        crash: {
            short: "CC",
            aliases: ["C", "C1", "CR"],
            long: "crash cymbal",
            midi: "A3",
            stave: "na"
        },
        hihatpedal: {
            short: "HF",
            aliases: ["HHF", "FH"],
            long: "hi hat foot",
            midi: "G#2",
            stave: "nD"
        },
    },

    lookupMidi: (note) => {
        let d = {};
        Object.keys(midi.DRUMS).forEach(key => {
            if(midi.DRUMS[key].midi == note) {
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
    kit.ctx = canvas.getContext("2d");
    kit.image = new Image();
    kit.image.onload = () => {
        canvas.width = kit.image.naturalWidth;
        canvas.height = kit.image.naturalHeight;
        kit.ctx.drawImage(kit.image, 0,0);
        kit.draw();        
    }
    kit.image.src=`media/${kit.name}/${kit.imageURL}`;

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
                //kit.draw(parts, "played");
            }, {
                channels: [10]
            });
        });
        /// TODO: add midi support
    }).catch((e) => {
        console.error(e);
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
        console.log("Played", note, "on", device);
    });
}

drumtab.timeSignature = [4,4];

kit.draw = (parts, played) => {

    let colour = "red";
    let ctx = kit.ctx;
    kit.ctx.drawImage(kit.image, 0,0);
    ctx.save();
    if(parts) {
        Object.keys(parts).forEach((k) => {
            s = kit.zones[k];    
            if(s) { 
                ctx.shadowBlur = 10;
                ctx.shadowColor = colour;   
                ctx.beginPath();
                ctx.ellipse(s.x + (s.w / 2), s.y + (s.h / 2), s.w / 2, s.h / 2, s.angle, 0, 2 * Math.PI);
                ctx.fillStyle = s.colour;
                ctx.fill();
                ctx.strokeStyle = colour;
                ctx.lineWidth = 5;
                ctx.stroke();
            } else {
                console.error("Unknown drum part", parts, k);
            }
        });
    }
    ctx.restore();
    ctx.font = "48px serif";
    // show timings
    if(drumtab.playback) {

        let beatsInBar = drumtab.drums.beats * 2;
        let bar = 1 + Math.floor(drumtab.playback.currentBeat / (beatsInBar));
        let beat = 1 + Math.floor((drumtab.playback.currentBeat * drumtab.timeSignature[0]/ (beatsInBar)) % (drumtab.timeSignature[0]));
        ctx.fillText(`${drumtab.repeatCount}:${bar}:${beat}`, 0, 48);
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
}
drumtab.repeatCount = 1;
drumtab.repeatTotal = 1;

drumtab.play = (repeatCount, done) => {
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
                    // some sounds might be on
                    let beatsInBar = drumtab.drums.beats * 2;
                    let bar = Math.floor(drumtab.playback.currentBeat / (beatsInBar));
                    let beat = (drumtab.playback.currentBeat / 2) % (beatsInBar/2);
                    let d = {
                        beat: beat,
                        bar: bar,
                        c: drumtab.playback.currentBeat,
                        repeat: repeatCount
                    }
                    if(drumtab.drums.bars[bar] && drumtab.drums.bars[bar].all[beat]) {
                        d.notes = drumtab.drums.bars[bar].all[beat];
                        kit.draw(drumtab.drums.bars[bar].all[beat]);
                        // play midi notes
                        if(drumtab.options.midi) {
                            Object.keys(d.notes).forEach((key) => {
                                let note = midi.lookup(key);
                                drumtab.playnote(note.midi);
                                console.log(note.midi);
                            });
                        }
                        // play audio notes
                        if(drumtab.options.audio) 
                        {
                            d.sounds = drumtab.drums.bars[bar].sounds[beat];
                            Object.keys(d.sounds).forEach((key) => {
                                d.sounds[key].pause();
                                d.sounds[key].currentTime = 0;
                                d.sounds[key].play();
                                //console.log(d.sounds[key].volume, key);
                            });
                        }
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
        bars: []
    }
    let text = "";
    let newPart = false;

    // go through each line of tab
    for(let i = 0; i < lines.length; i++) {        
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
                        drums.bars[j + startBar].before = "\n";
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
                            if(drums.bars[j + startBar].sounds[k] == undefined) {
                                drums.bars[j + startBar].sounds[k] = {};
                            }
                            drums.bars[j + startBar].all[k][voice.instrument] = bar[k];
                            let sndURL = `media/${kit.name}/${kit.zones[voice.instrument].sound}`;
                            
                            // create audio elements
                            drums.bars[j + startBar].sounds[k][voice.instrument] = new Audio(sndURL);
                            let accent = bar[k].toUpperCase() == bar[k];
                            drums.bars[j + startBar].sounds[k][voice.instrument].volume = accent?1:0.2;
                            
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
    "M: 4/4\n" +
    "L: 1/" + drums.beats + "\n" +
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
                    if(beatCount == drumtab.drums.beats / 2) {
                        abc += " ";
                    }
                }
                currentVoice++;
                if(currentVoice < voiceCount) {
                    if(drums.bars[i + 1] && drums.bars[i + 1].before.length > 0) {
                        // new line
                    } else {
                        abc += "&\\";
                    }
                    
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
