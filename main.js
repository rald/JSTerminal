let terminal = new Terminal(font, 2, 256, 256, palette);
terminal.setup();

async function main() {
    while (true) {
        terminal.print("> ");
        
        let line = "";
        let ch;
        
        // Read characters until Enter (newline code 10) is pressed
        while ((ch = await terminal.getchar()) !== 10) {
            if (ch === 8) { // Backspace handling
                if (line.length > 0) {
                    line = line.slice(0, -1);
                }
            } else {
                line += String.fromCharCode(ch);
            }
        }
        
        let command = line.trim();
        
        if (command === "cls") {
            terminal.cls();
        } else if (command.length > 0) {
            terminal.print(`You typed: ${line}\r\n`);
        }
    }
}

main();
