/**
 * @fileOverview
 *
 * RequireJS module providing some general support methods for accessing
 * Prolog
 *
 * @version 0.1.0
 * @author Jan Wielemaker, J.Wielemaker@vu.nl
 * @requires jquery
 */

define([ "jquery", "config", "form", "preferences", "editor" ],
       function($, config, form, preferences) {
  var prolog = {
    /**
     * Download query results as CSV.
     * @param {Object} [options]
     * @param {String} [options.projection] holds the Prolog projection
     * variables, separated by commas, e.g., `"X,Y"`
     * @param {String} [options.format="prolog"] holds a string that
     * defines the variation of the CSV format, e.g., `"prolog"` or
     * `"rdf"`
     * @param {String|Number} [options.limit] defines the max number of
     * results.
     * @param {Boolean} [options.distinct] requests only distinct
     * results.
     */
    downloadCSV: function(query, source, options) {
      options = options||{};

      if ( options.projection ) {
	var formel;
	var format = options.format||"prolog";

	function attr(name,value) {
	  return $.el.input({type:"hidden", name:name, value:value});
	}

	if ( options.distinct )
	  query = "distinct(["+options.projection+"],("+query+"))";
	if ( options.limit ) {
	  var limit = parseInt(options.limit.replace(/[ _]/g,""));

	  if ( typeof(limit) == "number" ) {
	    query = "limit("+limit+",("+query+"))";
	  } else {
	    alert("Not an integer: ", options.limit);
	    return false;
	  }
	}

	formel = $.el.form({ method:"POST",
                             action:config.http.locations.pengines+"/create",
			     target:"_blank"
		           },
			   attr("format", "csv"),
			   attr("chunk", "100000000"),
			   attr("application", "swish"),
			   attr("ask", query),
			   attr("src_text", source),
			   attr("template", format+"("+options.projection+")"));
	$("body").append(formel);
	formel.submit();
	$(formel).remove();
      } else {
	var vars = $().prologEditor('variables', query);

	function infoBody() {
	  var formel = $.el.form(
            {class:"form-horizontal"},
	    form.fields.projection(vars.join(",")),
	    form.fields.csvFormat(config.swish.csv_formats,
				  preferences.getVal("csvFormat")),
	    form.fields.limit("10 000", false),
	    form.fields.buttons(
	      { label: "Download CSV",
		action: function(ev, params) {
		  ev.preventDefault();
		  if ( config.swish.csv_formats.length > 1 )
		    preferences.setVal("csvFormat", params.format);
		  prolog.downloadCSV(query, source, params);

		  return false;
		}
	      }));
	  this.append(formel);
	}

	form.showDialog({ title: "Download query results as CSV",
			  body:  infoBody
		        });
      }

      return this;
      }
  }

  return prolog;
});

