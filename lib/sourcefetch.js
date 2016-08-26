'use babel';

import SourcefetchView from './sourcefetch-view';
import { CompositeDisposable } from 'atom';
import request from 'request';
import cheerio from 'cheerio';
import google from 'google';

google.resultsPerPage = 1

export default {

  sourcefetchView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.sourcefetchView = new SourcefetchView(state.sourcefetchViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.sourcefetchView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that fetches this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'sourcefetch:fetch': () => this.fetch()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.sourcefetchView.destroy();
  },

  serialize() {
    return {
      sourcefetchViewState: this.sourcefetchView.serialize()
    };
  },

  fetch() {
    let editor;
    if (editor = atom.workspace.getActiveTextEditor()){
      let selection = editor.getSelectedText();
      let language = editor.getGrammar().name;
      this.search(selection, language)
        .then((url) => {
          return this.download(url);
        })
        .then((html) => {
          let answer = this.scrape(html);
          if (answer === '') {
            atom.notifications.addWarning('No answers found :(');
          } else {
            editor.insertText(answer);
          }
        })
        .catch((error) => {
          atom.notifications.addWarning(error.reason);
        });
    }
  },

  search (query, language) {
    return new Promise((resolve, reject) => {
      let searchString = `${query} in ${language} site:stackoverflow.com`;

      google(searchString, (err, res) => {
        if (err) {
          reject({
            reason: 'A search error has occurred'
          });
        } else if (res.links.length === 0) {
          reject({
            reason: 'No results found!'
          });
        } else {
          resolve(res.links[0].href);
        }
      });
    });
  },

  scrape (html) {
    let $ = cheerio.load(html);
    return $('div.accepted-answer pre code').text();
  },

  download(url) {
    return new Promise((resolve, reject) => {
      request(url, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          resolve(body);
        } else {
          reject({
            reason: 'Unable to download page'
          });
        }
      });
    })
  }



};
