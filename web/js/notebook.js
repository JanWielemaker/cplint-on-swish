/**
 * @fileOverview
 * Manage the cell structure of a notebook modelled after IPython
 * NoteBook.  The nodebook consists of a toolbar with a series of
 * buttons and manages a list of cells.  The file defines two plugins
 * `notebook`, implementing the overall notebook and `nbCell`,
 * implementing a single cell.
 *
 * @version 0.2.0
 * @author Jan Wielemaker, J.Wielemaker@vu.nl
 */

define([ "jquery", "config", "tabbed",
	 "laconic", "runner", "storage", "sha1"
       ],
       function($, config, tabbed) {

var cellTypes = {
  "program":  { label:"Program" },
  "query":    { label:"Query" },
  "markdown": { label:"Markdown" },
};

(function($) {
  var pluginName = 'notebook';
  var clipboard = null;

  /** @lends $.fn.notebook */
  var methods = {
    /**
     * Initialize a Prolog Notebook.
     */
    _init: function(options) {
      return this.each(function() {
	var elem = $(this);
	var data = {};			/* private data */
	var toolbar;

	elem.addClass("notebook");
	elem.addClass("swish-event-receiver");

	elem.append(toolbar = $.el.div(
            {class:"nb-toolbar"},
	    glyphButton("trash", "delete", "Delete cell"),
	    glyphButton("copy", "copy", "Copy cell"),
	    glyphButton("paste", "paste", "Paste cell below"),
	    sep(),
	    glyphButton("chevron-up", "up", "Move cell up"),
	    glyphButton("chevron-down", "down", "Move cell down"),
	    sep(),
	    glyphButton("plus", "insertBelow", "Insert cell below"),
	    sep(),
	    glyphButton("play", "run", "Run")
	    ));
	elem.append($.el.div({class:"nb-content"}));

	$(toolbar).on("click", "a.btn", function(ev) {
	  var action = $(ev.target).closest("a").data("action");
	  elem.notebook(action);
	  ev.preventDefault();
	  return false;
	});

	elem.focusin(function(ev) {
	  elem.notebook('active', $(ev.target).closest(".nb-cell"));
	});

	elem.data(pluginName, data);	/* store with element */

					/* restore content */
					/* TBD: restore meta-data */
	var content = elem.find(".notebook-data");
	if ( content.length > 0 ) {
	  elem.notebook('value', content.text());
	  content.remove();
	} else {
	  elem.tabbed('title', "Notebook");
	}

	elem.notebook('setupStorage');
      });
    },

		 /*******************************
		 *	  BUTTON ACTIONS	*
		 *******************************/

    delete: function(cell) {
      cell = cell||currentCell(this);
      if ( cell ) {
	this.notebook('active', cell.next());
	cell.remove();
      }
      return this;
    },

    copy: function(cell) {
      cell = cell||currentCell(this);
      if ( cell )
	clipboard = $(cell).nbCell('saveDOM');
    },

    paste: function() {
      if ( clipboard ) {
	var newcell = $.el.div({class:"nb-cell"});
	this.notebook('insert', { where:"below", cell:newcell });
	$(newcell).nbCell($(clipboard));
      } else {
	alert("Clipboard is empty");
      }
    },

    up: function(cell) {
      cell = cell||currentCell(this);
      if ( cell )
	cell.insertBefore(cell.prev());
      return this;
    },

    down: function(cell) {
      cell = cell||currentCell(this);
      if ( cell )
	cell.insertAfter(cell.next());
      return this;
    },

    insertAbove: function() {
      return this.notebook('insert', { where:"above" });
    },

    insertBelow: function() {
      return this.notebook('insert', { where:"below" });
    },

    run: function(cell) {
      cell = cell||currentCell(this);
      if ( cell )
	cell.nbCell("run");
    },

    cellType: function(cell, type) {
      cell = cell||currentCell(this);
      if ( cell )
	cell.nbCell('type', type);
    },

		 /*******************************
		 *	 CELL MANAGEMENT	*
		 *******************************/

    active: function(cell, focus) {
      if ( cell && cell.length == 1 )
      { this.children(".nb-cell.active").removeClass("active");
	cell.addClass("active");
	if ( focus )
	  cell.focus();
      }
    },

    /**
     * Insert a new cell
     * @param {Object} [options]
     * @param {String} [options.where] defines where the cell is
     * inserted relative to the cell with the current focus.
     */
    insert: function(options) {
      options   = options||{};
      var relto = currentCell(this);
      var cell  = options.cell || $.el.div({class:"nb-cell"});

      if ( relto ) {
	if ( options.where == 'above' ) {
	  $(cell).insertBefore(relto);
	} else {
	  $(cell).insertAfter(relto);
	}
      } else {
	this.append(cell);
      }

      if ( !options.cell )
	$(cell).nbCell();
      this.notebook('active', $(cell));
    },

		 /*******************************
		 *	   SAVE/RESTORE		*
		 *******************************/

    /**
     * Setup connection to the storage manager.
     */
    setupStorage: function() {
      var notebook = this;
      var storage = {
        getValue: function() {
	  return notebook.notebook('value');
	},
	setValue: function(string) {
	  return notebook.notebook('value', string);
	},
	changeGen: function() {
	  return notebook.notebook('changeGen');
	},
	isClean: function(gen) {
	  return gen == notebook.notebook('changeGen');
	},
	cleanGeneration: this.notebook('changeGen'),
	cleanData:       this.notebook('value'),
	cleanCheckpoint: "load",
	dataType:        "swinb"
      };

      return this.storage(storage);
    },

    /**
     * Set or get the state of this notebook as a string.
     * @param [String] val is an HTML string that represents
     * the notebook state.
     */
    value: function(val) {
      if ( val == undefined ) {
	var dom = $.el.div({class:"notebook"});
	this.find(".nb-cell").each(function() {
	  cell = $(this);
	  $(dom).append(cell.nbCell('saveDOM'));
	});

	return $($.el.div(dom)).html();
      } else {
	var notebook = this;
	var dom = $.el.div();
	$(dom).html(val);
	$(dom).find(".nb-cell").each(function() {
	  var cell = $.el.div({class:"nb-cell"});
	  notebook.append(cell);
	  $(cell).nbCell($(this));
	});
      }
    },

    /**
     * Compute a state fingerprint for the entire notebook
     * @return {String} SHA1 fingerprint
     */
    changeGen: function() {
      this.find(".nb-cell").each(function() {
	var list = [];
	cell = $(this);
	list.push(cell.nbCell('changeGen'));
	return sha1(list.join());
      });
    }
  }; // methods

  // <private functions>

  function glyphButton(glyph, action, title) {
    var btn = $.el.a({href:"#", class:"btn btn-info btn-sm",
		      title:title, "data-action":action},
		     $.el.span({class:"glyphicon glyphicon-"+glyph}));

    return btn;
  }

  function sep() {
    return $.el.span({class:"thin-space"}, " ");
  }

  /**
   * @returns {Object|null} cell that is focussed and inside our
   * notebook.
   * @param {Object} nb is the notebook
   */
  function currentCell(nb) {
    var active = $(nb).find(".nb-cell.active");

    if ( active.length == 1 )
      return active.first();

    return null;
  }

  tabbed.tabTypes.notebook = {
    label: "Notebook",
  };

  /**
   * <Class description>
   *
   * @class notebook
   * @tutorial jquery-doc
   * @memberOf $.fn
   * @param {String|Object} [method] Either a method name or the jQuery
   * plugin initialization object.
   * @param [...] Zero or more arguments passed to the jQuery `method`
   */

  $.fn.notebook = function(method) {
    if ( methods[method] ) {
      return methods[method]
	.apply(this, Array.prototype.slice.call(arguments, 1));
    } else if ( typeof method === 'object' || !method ) {
      return methods._init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.' + pluginName);
    }
  };
}(jQuery));

		 /*******************************
		 *	    PLUGIN nbCell	*
		 *******************************/

(function($) {
  var pluginName = 'nbCell';
  var id = 0;				/* generate unique cell ids */

  /** @lends $.fn.nbCell */
  var methods = {
    /**
     * Create a new notebook cell
     * @param {jQuery} [dom] initialise the new cell from the saved
     * DOM
     */
    _init: function(dom) {
      return this.each(function() {
	var elem = $(this);
	var data = {};			/* private data */
	var g;

	elem.data(pluginName, data);	/* store with element */
	elem.attr("tabIndex", -1);
	elem.attr("id", "nbc"+id++);

	if ( dom instanceof jQuery ) {
	  elem.nbCell('restoreDOM', dom);
	} else {
	  elem.append($.el.div({class:"nb-type-select"},
			       $.el.label("Create a "),
			       g=$.el.div({class:"btn-group",role:"group"}),
			       $.el.label("cell here.")));

	  for(var k in cellTypes) {
	    if ( cellTypes.hasOwnProperty(k) )
	      $(g).append($.el.button({ type:"button",
					class:"btn btn-default",
					"data-type":k
				      },
				      cellTypes[k].label));
	  }

	  $(g).on("click", ".btn", function(ev) {
	    elem.nbCell('type', $(ev.target).data('type'));
	  });
	}
      });
    },

    type: function(type) {
      var data = this.data(pluginName);
      if ( data.type != type ) {
	methods.type[type].apply(this);
	data.type = type;
	this.addClass(type);
      }
      return this;
    },

    /**
     * Run the current cell
     */
    run: function() {
      if ( this.hasClass("runnable") ) {
	var data = this.data(pluginName);

	return methods.run[data.type].apply(this, arguments);
      } else {
	alert("Cell is not runnable");
      }
    },

    saveDOM: function() {
      return methods.saveDOM[this.data(pluginName).type].call(this);
    },

    restoreDOM: function(dom) {
      var data = this.data(pluginName);

      function domCellType(dom) {
	for(var k in cellTypes) {
	  if ( cellTypes.hasOwnProperty(k) && dom.hasClass(k) )
	    return k;
	}
      }

      data.type = domCellType(dom);
      methods.restoreDOM[data.type].apply(this, arguments);
      this.addClass(data.type);
    },

    /**
     * Compute a state fingerprint for the current cell.
     */
    changeGen: function() {
      return methods.changeGen[this.data(pluginName).type].call(this);
    }
  }; // methods

		 /*******************************
		 *	     SET TYPE		*
		 *******************************/

  methods.type.markdown = function(options) {	/* markdown */
    var editor;

    options = options||{};
    options.mode = "markdown";

    this.html("");
    this.append(editor=$.el.div({class:"editor"}));
    $(editor).prologEditor(options);
    this.addClass("runnable");
  }

  methods.type.program = function(options) {	/* program */
    var editor;

    options = options||{};

    this.html("");
    this.append(editor=$.el.div({class:"editor"}));
    $(editor).prologEditor(options);
  }

  methods.type.query = function(options) {	/* query */
    var editor;
    var cell = this;

    options = $.extend({}, options,
		       { role: "query",
		       //sourceID: options.sourceID,
		         placeholder: "Your query goes here ...",
			 lineNumbers: false,
			 lineWrapping: true,
			 prologQuery: function(q) {
			   cell.nbCell('run');
			 }
		       });

    this.html("<span class='prolog-prompt'>?-</span>");
    this.append(editor=$.el.div({class:"editor query"}));
    $(editor).prologEditor(options);
    this.addClass("runnable");
  }


		 /*******************************
		 *	    RUN BY TYPE		*
		 *******************************/

  methods.run.markdown = function(markdownText) {	/* markdown */
    var cell = this;

    markdownText = markdownText||cellText(this);

    function makeEditable(ev) {
      var cell = $(ev.target).closest(".nb-cell");
      var text = cell.data('markdownText');
      cell.removeData('markdownText');
      methods.type.markdown.call(cell, {value:text});
      cell.off("dblclick", makeEditable);
    }

    $.get(config.http.locations.markdown,
	  { text: markdownText
	  },
	  function(data) {
	    cell.html(data);
	    cell.removeClass("runnable");
	    cell.data('markdownText', markdownText);
	    cell.on("dblclick", makeEditable);
	  });
  };

  methods.run.program = function() {		/* program */
    alert("Please define a query to run this program");
  };

  methods.run.query = function() {		/* query */
    var query = { source: "",			/* TBD */
                  query: cellText(this),
		  tabled: true
                };
    var runner = $.el.div({class: "prolog-runner"});
    this.find(".prolog-runner").remove();
    this.append(runner);
    $(runner).prologRunner(query);
  };

		 /*******************************
		 *	SAVE/RESTORE DOM	*
		 *******************************/

/* ---------------- saveDOM ---------------- */

  methods.saveDOM.markdown = function() {	/* markdown */
    var text = this.data('markdownText') || cellText(this);

    return $.el.div({class:"nb-cell markdown"}, text);
  };

  methods.saveDOM.program = function() {	/* program */
    return $.el.div({class:"nb-cell program"}, cellText(this));
  };

  methods.saveDOM.query = function() {		/* query */
    return $.el.div({class:"nb-cell query"}, cellText(this));
  };

/* ---------------- restoreDOM ---------------- */

  methods.restoreDOM.markdown = function(dom) {	/* markdown */
    var text = dom.text();
    this.data('markdownText', text);
    methods.run.markdown.call(this, text);
  };

  methods.restoreDOM.program = function(dom) {	/* program */
    methods.type.program.call(this, {value:dom.text()});
  };

  methods.restoreDOM.query = function(dom) {	/* query */
    methods.type.query.call(this, {value:dom.text()});
  };

/* ---------------- changeGen ---------------- */

  methods.changeGen.markdown = function() {	/* markdown */
    var text = this.data('markdownText') || cellText(this);

    return sha1(text);
  };

  methods.changeGen.program = function() {	/* program */
    return sha1(cellText(this));
  };

  methods.changeGen.query = function() {	/* query */
    return sha1(cellText(this));
  };


		 /*******************************
		 *	     UTILITIES		*
		 *******************************/

  function cellText(cell) {
    return cell.find(".editor").prologEditor('getSource');
  }

  /**
   * <Class description>
   *
   * @class nbCell
   * @tutorial jquery-doc
   * @memberOf $.fn
   * @param {String|Object} [method] Either a method name or the jQuery
   * plugin initialization object.
   * @param [...] Zero or more arguments passed to the jQuery `method`
   */

  $.fn.nbCell = function(method) {
    if ( methods[method] ) {
      return methods[method]
	.apply(this, Array.prototype.slice.call(arguments, 1));
    } else if ( typeof method === 'object' || !method ) {
      return methods._init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.' + pluginName);
    }
  };
}(jQuery));


});