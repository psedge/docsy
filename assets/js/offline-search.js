// Adapted from code by Matt Walters https://www.mattwalters.net/posts/hugo-and-lunr/

(function ($) {
    'use strict';

    $(document).ready(function () {
        const $searchInput = $('.td-search-input');

        //
        // Options for popover
        //

        $searchInput.data('html', true);
        $searchInput.data('placement', 'bottom');
        $searchInput.data(
            'template',
            '<div class="popover offline-search-result" role="tooltip"><div class="arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>'
        );

        //
        // Register handler
        //

        $searchInput.on('change', (event) => {
            render($(event.target));

            // Hide keyboard on mobile browser
            $searchInput.blur();
        });

        // Prevent reloading page by enter key on sidebar search.
        $searchInput.closest('form').on('submit', () => {
            return false;
        });

        //
        // Lunr
        //

        let idx = null; // Lunr index
        const resultDetails = new Map(); // Will hold the data for the search results (titles and summaries)

        // Set up for an Ajax call to request the JSON data file that is created by Hugo's build process
        $.ajax($searchInput.data('offline-search-index-json-src'))
            .fail((err) => {
                console.log(err)
            })
            .then(
            (data) => {
                idx = lunr(function () {
                    this.ref('ref');

                    // If you added more searchable fields to the search index, list them here.
                    // Here you can specify searchable fields to the search index - e.g. individual toxonomies for you project
                    // With "boost" you can add weighting for specific (default weighting without boost: 1)
                    this.field('title', { boost: 15 });
                    this.field('categories', { boost: 3 });
                    this.field('tags', { boost: 10 });
                    this.field('description', { boost: 10 });
                    this.field('body', { boost: 5 });

                    data.forEach((doc) => {
                        this.add(doc);

                        resultDetails.set(doc.ref, {
                            title: doc.title,
                            excerpt: doc.excerpt,
                            tags: doc.tags,
                            lastMod: doc.last_mod,
                            description: doc.description,
                        });
                    });
                });

                $searchInput.trigger('change');
            },

        );

        const render = ($targetSearchInput) => {
            // Dispose the previous result
            $targetSearchInput.popover('dispose');

            //
            // Search
            //

            if (idx === null) {
                return;
            }

            const searchQuery = $targetSearchInput.val();
            if (searchQuery === '') {
                return;
            }

            const results = idx
                .query((q) => {
                    const tokens = lunr.tokenizer(searchQuery.toLowerCase());
                    tokens.forEach((token) => {
                        const queryString = token.toString();
                        q.term(queryString, {
                            boost: 100,
                        });
                        q.term(queryString, {
                            wildcard:
                                lunr.Query.wildcard.LEADING |
                                lunr.Query.wildcard.TRAILING,
                            boost: 10,
                        });
                        q.term(queryString, {
                            editDistance: 2,
                        });
                    });
                })
                .slice(0, $targetSearchInput.data('offline-search-max-results'))
                .filter(r => r.score > 2);

            //
            // Make result html
            //

            const $html = $('<div>');

            $html.append(
                $('<div>')
                    .css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0'
                    })
                    .append(
                        $('<span>')
                            .text('')
                            .css({ fontWeight: 'bold' })
                    )
                    .append(
                        $('<i>')
                            .addClass('fas fa-times search-result-close-button')
                            .css({
                                cursor: 'pointer',
                            })
                    )
            );

            const $searchResultBody = $('<div>').css({
                maxHeight: `calc(100vh - ${
                    $targetSearchInput.offset().top -
                    $(window).scrollTop() +
                    180
                }px)`,
                minHeight: "150px",
                overflowY: 'auto',
            });
            $html.append($searchResultBody);

            if (results.length === 0) {
                $searchResultBody.append(
                    $('<p>').text(`No results found for query "${searchQuery}"`)
                );
            } else {
                results.forEach((r) => {
                    const $cardHeader = $('<div>').addClass('card-header');
                    const $cardHeaderContext = $('<div>').addClass('card-header-context')
                    const doc = resultDetails.get(r.ref);
                    const href = $searchInput.data('offline-search-base-href') + r.ref.replace(/^\//, '');

                    $cardHeader.append($('<a>')
                            .css('float', 'left')
                            .attr('href', href)
                            .text(doc.title));
                    $cardHeader.append($('<span>')
                            .addClass('last-mod')
                            .text(doc.lastMod.substring(0, 10)));
                    $cardHeader.append($('<i>')
                            .addClass('fa')
                            .addClass('fa-edit')
                            .addClass('last-mod'));

                    // Build the breadcrumbs path as we iterate it
                    let breadcrumbsDiv = $('<div>').addClass("breadcrumbs")
                    let breadcrumbsTrail = ""
                    let breadcrumbsParts = href.split('/').slice(0, self.length-1)

                    breadcrumbsParts.forEach((p, i) => {
                        breadcrumbsTrail += p + "/"
                        breadcrumbsDiv.append($('<a>')
                                .addClass("search-breadcrumb")
                                .attr('href', breadcrumbsTrail)
                                .text(p))
                        if (i !== breadcrumbsParts.length) breadcrumbsDiv.append($('<span>')
                                .addClass("search-breadcrumb")
                                .text('/'))
                    })
                    $cardHeaderContext.append(breadcrumbsDiv)

                    let tagsDiv = $('<div>').addClass("tags")
                    console.log(doc.tags)
                    if (doc.hasOwnProperty('tags') && doc.tags != undefined && doc.tags.length > 0)
                        doc.tags.forEach((t) => tagsDiv.append($('<span>')
                                .addClass('tag')
                                .addClass('label')
                                .addClass('label-default')
                                .text("#" + t)))

                    $cardHeaderContext.append(tagsDiv)
                    $cardHeader.append($cardHeaderContext)

                    const $cardBody = $('<div>').addClass('card-body');

                    // Appending content to a temporary div, then extracting it gives text without specialchars
                    if (doc.description !== "" && doc.description != undefined) $cardBody.append($('<p>')
                                .addClass('card-text description')
                                .text($('<div>'+doc.description+'</div>').text()));

                    $cardBody.append($('<p>')
                            .addClass('card-text text-muted')
                            .text($('<div>'+doc.excerpt+'</div>').text()));

                    const $card = $('<div>').addClass('card');
                    $card.append($cardHeader).append($cardBody);
                    $searchResultBody.append($card);
                });
            }

            $targetSearchInput.on('shown.bs.popover', () => {
                $('.search-result-close-button').on('click', () => {
                    $targetSearchInput.val('');
                    $targetSearchInput.trigger('change');
                });
            });

            // Enable inline styles in popover.
            const whiteList = $.fn.tooltip.Constructor.Default.whiteList;
            whiteList['*'].push('style');

            $targetSearchInput
                .data('content', $html[0].outerHTML)
                .popover({ whiteList: whiteList })
                .popover('show');
        };
    });
})(jQuery);
