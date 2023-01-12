let midi= {
    NOTE_ON: 9,
    NOTE_OFF: 8,
    NOTE_NAMES: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    DRUMS: {
        snare: {
            short: "SN",
            aliases: ["S"],
            long: "snare",
            midi: "D2",
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
            midi: "Gb2",
            stave: "ng"
        }
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
            [
                ["CC", "HH", "RD", "HF"],
                ["SN", "T1", "T2", "FT", "BD"]
            ]
        ]
    }
];

drumtab.Tab2ABC = (tab, voicing) => {
    if(voicing === undefined) {
        voicing = drumtab.voicingOptions[1];
    }
    let lines = tab.split("\n");
    let drums = {
        bars: []
    }

    // go through each line of tab
    for(let i = 0; i < lines.length; i++) {
        
        // extract part names
        let m = lines[i].match(/^\s*([A-Za-z]+)\s*:?\s*\|/);
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
                    voice.bars[j] = bar;
                    
                    // store bar for all parts
                    while(drums.bars.length < bars.length - 1) {
                        let newBar = {
                            parts: {},
                            notes: bar.length,
                            skip: 0,
                            all: {},
                            voicing: {}
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
                            if(drums.bars[j].all[k] === undefined) {
                                drums.bars[j].all[k] = {};
                            }
                            drums.bars[j].all[k][voice.instrument] = bar[k];
                            
                            // split into different stave voices
                            for(let l = 0; l < voicing.voices.length; l++) {
                                if(voicing.voices[l].includes(voice.instrument)) {
                                    if(drums.bars[j].voicing[voicing.names[l]].parts[voice.instrument] === undefined) {
                                        drums.bars[j].voicing[voicing.names[l]].parts[voice.instrument] = {};
                                    }
                                    drums.bars[j].voicing[voicing.names[l]].parts[voice.instrument][k] = bar[k];
                                    if(drums.bars[j].voicing[voicing.names[l]].beats[k] === undefined) {
                                        drums.bars[j].voicing[voicing.names[l]].beats[k] = [];
                                    }
                                    let note = {};
                                    note = {
                                        instrument: voice.instrument,
                                        style: bar[k],
                                        duration: duration,
                                        abc: (bar[k] == "O"||bar[k] == "X"?"!^!":"") + 
                                            instrument.stave + 
                                            (duration>1?duration:"")
                                    }
                                    drums.bars[j].voicing[voicing.names[l]].beats[k].push(note);
                                }
                            }
                        }
                    }                        
                    drums.bars[j].parts[voice.instrument] = voice.bars[j];
                }
            }
        }
    }

    // get max number of beats in a bar
    drums.beats = 1;
    for(let i = 0; i < drums.bars.length; i++) {
        if(drums.bars[i].notes > drums.beats) {
            drums.beats = drums.bars[i].notes;
        }
    }
    console.log(drums);

    let abc = "X: 1\n" +
    "M: 4/4\n" +
    "L: 1/" + drums.beats + "\n" +
    "U:n=!style=x!\n" +
    "K:perc\n"

    for(let i = 0; i < drums.bars.length; i++) {
        abc += "|";
        let voiceCount = Object.keys(drums.bars[i].voicing).length;
        let currentVoice = 0;
        for(const [voiceName, v] of Object.entries(drums.bars[i].voicing)) {
            for(const [beat, notes] of Object.entries(v.beats)) {
                if(notes.length > 1) {
                    abc += "[";
                }                 
                for(let j = 0; j < notes.length; j++) {
                    abc += notes[j].abc;
                }

                if(notes.length > 1) {
                    abc += "]";
                }
                console.log(voiceName, beat, notes)
            }
            if(currentVoice < voiceCount) {
                abc += "&\\";
            } else {
                abc += "|";
            }
            
            currentVoice++;
        }
    }

    /// todo: not quite there yet!
    "|:ngngngngngngngng&\\\n" +
    "!^!F2c2F2c2:|"
    return abc;
}
