'use strict';
const vscode = require('vscode');
const Window = vscode.window;
const fs = require('fs');
const path = require('path');
const config = vscode.workspace.getConfiguration('epub');
const styleNumPage=config.get('styleNumPage');
const niveauTitre=config.get('niveauTitre');


function fichierLiens(type) {
    var mesXhtml = recupFichiers(type);
    var Liens = {};
    mesXhtml.forEach(function (el) {
        var el2 = path.basename(el);
        Liens[el2] = el;
    });
    return Liens;
}

function recupFichiers(typeOrfichier) {
    return getFilesFromDir(pathOEBPS().path, typeOrfichier);
}

function pathOEBPS() {
    let fName = Window.activeTextEditor.document.fileName;
    let dossier = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fName));
    let dparse = path.dirname(fName).split(path.sep);
    let fullPath = false;
    while (!fullPath) {
        let pop = dparse.pop();
        if (pop === dossier.name) {
            break;
        }
        let mapop = path.sep + pop + path.sep;
        let chemin = fName.substring(0, fName.indexOf(mapop));
        fullPath = _chercheRoot(chemin);
    }
    return fullPath;
}

function testOEBPS() {
    let e = Window.activeTextEditor;
    let d = e.document;
    let chemin = pathOEBPS().path;
    if (d.fileName.indexOf(chemin) !== -1) {
        return true
    }
    return false
}

function _chercheRoot(dir) {
    let cont = getFilesFromDir(dir, 'container.xml');
    if (!cont) {
        return false;
    }
    let data = fs.readFileSync(cont);
    let regex1 = new RegExp('full-path="([^"]+)"', 'g');
    let result = regex1.exec(data);
    return {
        "filename": result[1].split('/')[0],
        "path": path.join(cont.substring(0, cont.indexOf('META-INF')), result[1].split('/')[0])
    }
}


// Return a list of files of the specified fileTypes in the provided dir, 
// with the file path relative to the given dir
// dir: path of the directory you want to search the files for
// fileTypes: array of file types you are search files, ex: ['.txt', '.jpg']
function getFilesFromDir(dir, typeO) {
    var filesToReturn = [],
        type = typeO,
        fichier = false;
    if (type && type.split('.')[0] !== '') {
        fichier = true;
        filesToReturn = '';
    }

    function walkDir(currentPath) {
        var files = fs.readdirSync(currentPath);
        for (var i in files) {
            var curFile = path.join(currentPath, files[i]);
            if (fichier === true && files[i] === type) {
                filesToReturn = curFile;
            }
            if (!typeO) type = path.extname(curFile);
            if (fs.statSync(curFile).isFile() && path.extname(curFile) === type) {
                filesToReturn.push(curFile);
            } else if (fs.statSync(curFile).isDirectory()) {
                walkDir(curFile);
            }
        }
    };
    walkDir(dir);

    return filesToReturn;
}

function transformePageNoire(fichiersXhtml) {
    Object.values(fichiersXhtml).forEach(el => {
        var data = fs.readFileSync(el, 'utf8');
        var exp = '<span class="'+styleNumPage+'">(.[^<]*)</span>';
        var re = new RegExp(exp, 'gi');
        data = data.replace(re, '<span id="page$1" title="$1" epub:type="pagebreak" role="doc-pagebreak"></span>');
        fs.writeFileSync(el, data);
    });
}

function insertEditorSelection(text) {
    const editor = vscode.window.activeTextEditor;
    const selections = editor.selections;
    editor.edit((editBuilder) => {
        selections.forEach((selection) => {
            editBuilder.insert(selection.active, text);
        });
    });
}

function remplaceDansFichier(fichier, texte, balise, epubType) {
    let data = fs.readFileSync(fichier, 'utf8');
    let rpl = data.remplaceEntre2Balises(balise, texte, epubType);
    fs.writeFileSync(fichier, rpl);
}

function rechercheTitre(texte, nivT) {
    nivT = nivT || niveauTitre;
    var exp = '<h[1-' + nivT + '][^>]*>(?:.|\n|\r)*?<\/h[1-' + nivT + ']>?',
        re = new RegExp(exp, 'gi'),
        result = texte.match(re);
    return result;
}


function epureBalise(texte) {
    // Supprime notes
    var note = new RegExp('<span[^>]+id=(?:"|\')footnote-[0-9]*-backlink(?:"|\')[^>]*>((.|\s|\n|\r)*?)<\/span>', 'gi');
    texte = texte.replace(note, '');

    var txtTOC = texte,
        txt = texte,
        baliseAsupp = ['a', 'span', 'sup'];

    baliseAsupp.forEach(bal => {
        var h = new RegExp('<' + bal + '[^>]+>((?:.|\n|\r)*?)<\/' + bal + '>', 'gi');
        var re;
        while ((re = h.exec(texte)) !== null) {
            txtTOC = (re[1] === "" || !re[1]) && txtTOC.replace(re[0], '') || txtTOC;
            txt = (re[1] === "" || !re[1]) && txt.replace(re[0], '') || txt.replace(re[0], re[1]);
        }
        txtTOC = txtTOC.replace(/[\n\r]/g, '');
        txt = txt.replace(/[\n\r]/g, '');
        txtTOC = txtTOC.replace(/\s{2,}/g, ' ');
        txt = txt.replace(/\s{2,}/g, ' ');
        txtTOC = txtTOC.trim();
        txt = txt.trim();
    });

    return {
        'toc': txtTOC,
        'txt': txt,
    };
}

module.exports = {
    recupFichiers,
    fichierLiens,
    transformePageNoire,
    remplaceDansFichier,
    rechercheTitre,
    testOEBPS,
    pathOEBPS,
    epureBalise,
    insertEditorSelection
};