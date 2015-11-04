//check scopes


/*
 * MODELS
 */

var Category = can.Model({

}, {
    name: null,
    items: null
});

var Group = can.Model({

}, {
    name: null,
    subitems: null,

    isGroup: function () {
        return true
    }
});

var Item = can.Model({

}, {
   name: null,
   category: null,
   group: null,
   price: null,
});

/*
 * FETCHER
 */

var names = 'You probably havent heard of them trust fund Etsy locavore cray, 8-bit Williamsburg YOLO whatever vinyl bespoke. Squid Intelligentsia chillwave trust fund farm-to-table cold-pressed, Williamsburg gentrify disrupt 90s. Flannel Odd Future skateboard, lumbersexual lo-fi trust fund mixtape. Craft beer Marfa food truck quinoa bicycle rights fingerstache. Gentrify Tumblr Schlitz cronut mumblecore Pitchfork, freegan meggings banjo master cleanse 90s locavore flexitarian. Readymade organic synth, cold-pressed selvage mlkshk beard chambray farm-to-table cornhole iPhone cred pug. 8-bit DIY mumblecore, tilde health goth heirloom vegan church-key.'
        .split(' ');

function word (i) {
    return names[( i % names.length )] + ' ' + names[( (i + 1) % names.length )];
}



function getData () {

    var cats = new can.List();

    var sum = 0;

    for (var a = 0; a < 3; a++) {

        var cat = new Category({
            name: word(a),
            items: []
        });

        for (var b = 0; b < 40; b++) {

            var next;

            if ( ((a + b) % 4) == 0 ) {

                next = new Group({ name: word(a + b + 2), category: cat, subitems: [] });

                for (var c = 0; c < ((a + b) % 4) + 2; c++) {
                    next.subitems.push(new Item({ name: word(a + b + c), category: cat, group: next, price: (((a+2) * (b+1) * (c+2)) % 1000) }));
                    sum++;
                }

            } else {
                next = new Item({ name: word(a + b + 1), category: cat, price: (((a+3) * (b+2)) % 1000) });
                sum++;
            }

            cat.items.push(next);
        }

        cats.push(cat);
    }

    console.log("TOTALS: ", sum);

    return cats;

};

/*
 * MOVER
 */

function Mover ($element, $container) {
    this.$element = $element;
    this.$container = $container;
};

Mover.prototype = {

    $element: null,

    $container: null,

    _isBroken: false,

    _offset: null,

    _movingContainer: null,

    _movingContainerHeight: 0,

    _placeHolder: null,

    _containerBounds: null,

    _mergeWith: null,

    _selectedGroupItems: null,

    _selectedGroupHeader: null,

    _placeholderAtBottomOfGroup: false,

    _isMovingGroup: false,

    _styleElement: null,

    _atInitialPosition: true,

    run: function (event) {

        if (this.$element.hasClass('category')) {
            return;
        }

        var $window = can.$(window);
        var self = this;

        // kill phones scroll
        //addEventListener('touchmove', function(e) { e.preventDefault(); }, true);

        function onMouseMove (event) {
            self._onMouseMove(event);
        }

        function onMouseUp (event) {
            self._onMouseUp(event);

            $window.unbind('mousemove', onMouseMove);
            $window.unbind('mouseup', onMouseUp);
        }

        $window.on('mousemove', onMouseMove);
        $window.on('mouseup', onMouseUp);
    },

    _onMouseMove: function (event) {

        if (!this._isBroken) {
            this._isBroken = true;

            var containerOffset = this.$container.offset();
            var elementOffset = this.$element.offset();

            this._offset = {
                containerTop: containerOffset.top,
                x: event.clientX - ( ( elementOffset.left - containerOffset.left ) - document.documentElement.scrollLeft),
                y: event.clientY - ( ( elementOffset.top - containerOffset.top ) - document.documentElement.scrollTop),
            };

            var containerWidth = this.$container.width();
            var containerHeight= this.$container.height();

            this._containerBounds = {
                xAxis: Math.round(containerOffset.left + ( containerWidth / 2)),
                top: containerOffset.top + 1,
                bottom: containerOffset.top + containerHeight - 1,
            };

            this._breakTable();

            this.$element.trigger('drag-started', { he: 1 });
        }

        var absCursorY = event.clientY + document.documentElement.scrollTop - this._offset.y;

        this._movingContainer.css({
            top: absCursorY + 'px',
            left: ( event.clientX + document.documentElement.scrollLeft - this._offset.x) + 'px'
        });

        this._processCurrentCoordinate(absCursorY);
    },

    _onMouseUp: function (event) {
        if (this._isBroken) {
            var $beforePlaceholder = this._placeHolder.prev();

            this._rebuildTable();

            var $fireAt = $beforePlaceholder;
            var mergeWith = false;

            if ($fireAt.is(this._movingContainer) || (this._mergeWith !== null && this._mergeWith.is(this._movingContainer))) {
                $fireAt = this.$element;
            } else if (this._mergeWith !== null) {
                $fireAt = this._mergeWith;
                mergeWith = true;

            } else if (this._placeholderAtBottomOfGroup && this._selectedGroupHeader === null) {
                // put it after the group

                $fireAt = $beforePlaceholder;

                while ($fireAt.length !== 0 && !$fireAt.hasClass('group')) {
                    $fireAt = $fireAt.prev();
                }
            }

            $fireAt.trigger('drag-ended', {
                mergeWith: mergeWith,
                isInGroup: this._selectedGroupHeader !== null
            });

            this._cleanSelectedGroup();
        }
    },

    _processCurrentCoordinate: function (absCursorY) {

        // what's on top
        absCursorY -= 2;
        var $under = this._getTrUnderCoordinate(absCursorY);
        var top = true;
        var $mergeWith = null;

        // or what's on the bottom
        var topIsUnaccessible = this._isMovingGroup && ($under.isGroup || ($under.isSubItem && $under.next().hasClass('subitem')));

        if ($under.isPlaceholder || $under.prev().is(this._placeHolder) || topIsUnaccessible) {
            absCursorY += this._movingContainerHeight + 3;
            $under = this._getTrUnderCoordinate(absCursorY);
            top = false;
        }

        if (!$under.isPlaceholder) {

            var relativePosition = this._relativePositionInRow(absCursorY, $under, top);
            var $sibling = this._fillMetaInfo( top ? $under.next() : $under.prev() );

            var movePlaceHolder = !$sibling.isPlaceholder && relativePosition > 0.33;

            if (movePlaceHolder && this._isMovingGroup) {

                var cantMoveInGroup = $under.isSubItem && (!top || $sibling.isSubItem);
                movePlaceHolder = !cantMoveInGroup && (!top || !$under.isGroup);
            }

            // move placeholder after first 1/3 of second field
            if (movePlaceHolder) {
                this._movePlaceholder($under, $sibling, top);
            }

            // merge with (just with ungrouped item)
            if (!this._isMovingGroup && !movePlaceHolder
                    && ((relativePosition > 0.66 && $sibling.isPlaceholder) || (relativePosition < 0.33 && !$sibling.isPlaceholder))) {

                $mergeWith = this._toggleMergeSelection($sibling, $under);
            }

            // just when there is last groupped item at top of placeholder
            console.log('condition', {
                atBottom: this._placeholderAtBottomOfGroup,
                top: top,
                firstCondition: ($sibling.isPlaceholder && relativePosition >= 0.5),
                secondCondition: !$sibling.isPlaceholder && !movePlaceHolder,
                atInitial: this._atInitialPosition,
                wasInState: this._selectedGroupHeader !== null
            })
            if (this._placeholderAtBottomOfGroup && top && (($sibling.isPlaceholder && relativePosition >= 0.5) || (!$sibling.isPlaceholder && !movePlaceHolder) || this._atInitialPosition)) {
                this._toggleGroupSelection($under);
            } else if (this._placeholderAtBottomOfGroup) {
                this._toggleGroupSelection(null);
            }
        }

        if ($mergeWith === null && this._mergeWith !== null) {
            // reset mergeWith
            this._mergeWith.removeClass('merge');
            this._mergeWith = null;
        }
    },

    _relativePositionInRow: function (absCursorY, $under, top) {
        var cellOffsetTop = absCursorY - $under[0].offsetTop;
        var height = $under.height();
        return top ? ((height - cellOffsetTop) / height) : (cellOffsetTop / height);
    },

    _toggleMergeSelection: function ($sibling, $under) {

        var $mergeWith;

        if ($sibling.isPlaceholder) {
            $mergeWith = $under;
        } else {
            $mergeWith = $sibling;
        }

        var notAGroup = !$mergeWith.isSubItem && !$mergeWith.isGroup && !$mergeWith.hasClass('category');

        if (notAGroup
                && (this._mergeWith === null || this._mergeWith[0] != $mergeWith[0])) {

            if (this._mergeWith !== null) {
                this._mergeWith.removeClass('merge');
            }
            $mergeWith.addClass('merge');
            this._mergeWith = $mergeWith;
        }

        return $mergeWith;
    },

    _movePlaceholder: function ($under, $sibling, top) {
        this._placeholderAtBottomOfGroup = false;

        if ($under.isSubItem && !this._isMovingGroup && (!top || $under.next().hasClass('subitem')) || ($under.isGroup && top)) {

            this._toggleGroupSelection($under);
        } else if (!this._isMovingGroup) {
            var siblingIsSubitem = $sibling.isSubItem;

            if ((top && $under.isSubItem && !siblingIsSubitem)
                || (!top && !$under.isSubItem && siblingIsSubitem)) {
                this._placeholderAtBottomOfGroup = true;
            } else {
                this._toggleGroupSelection(null);
            }
        }

        // move placeholder

        if (top) {
            $under.after(this._placeHolder);
            this._atInitialPosition = this._placeHolder.next().is(this._movingContainer);
        } else {
            $under.before(this._placeHolder);
            this._atInitialPosition = this._placeHolder.prev().is(this._movingContainer);
        }



        console.log('moved', this._atInitialPosition);
    },

    _toggleGroupSelection: function ($element) {
        if ($element && ($element.hasClass('subitem') || $element.hasClass('group'))) {

            var $groupHeader = $element;
            var items = [];

            while ($groupHeader.length !== 0 && !$groupHeader.hasClass('group')) {
                items.push($groupHeader[0]);
                $groupHeader = $groupHeader.prev();
            }

            if (this._selectedGroupHeader !== null && this._selectedGroupHeader[0] == $groupHeader[0]) {
                // it's the same, there's no need to overwrite it
                return;
            }

            var $next = $element.next();

            while ($next.length !== 0 && $next.hasClass('subitem')) {
                items.push($next[0]);
                $next = $next.next();
            }

            this._selectedGroupItems = can.$(items);
            this._selectedGroupHeader = $groupHeader;

            $groupHeader.addClass('addToGroup');
            this._selectedGroupItems.addClass('addToGroup');

        } else {
            this._cleanSelectedGroup();
        }
    },

    _cleanSelectedGroup: function () {
        if (this._selectedGroupHeader !== null) {
            this._selectedGroupHeader.removeClass('addToGroup');
            this._selectedGroupItems.removeClass('addToGroup');

            this._selectedGroupItems = null;
            this._selectedGroupHeader = null;
        }
    },

    _getTrUnderCoordinate: function (y) {
        var y = y + this._offset.containerTop - document.documentElement.scrollTop;
        var $elem = can.$( document.elementFromPoint( this._containerBounds.xAxis, y ) );
        return this._fillMetaInfo( $elem.closest('.tr', this.$container) );
    },

    _fillMetaInfo: function ($elem) {
        $elem.isSubItem = $elem.hasClass('subitem');
        $elem.isGroup = $elem.hasClass('group');
        $elem.isPlaceholder = $elem.length === 0 || $elem.is(this._placeHolder);
        return $elem;
    },

    _breakTable: function () {

        var index = this.$element.index();

        var $cells = this.$element.children('.td');
        var widths = [];

        $cells.each(function (i, cell) {
            var width = can.$(cell).width();
            widths.push(width);
        });

        var height = $cells.height();
        var width = this.$element.width();
        var toMove = this._findWhatToMove();

        var css = '.tr { display: block; }, .td { height: ' + height + 'px; float: left; display: block; }';

        for (var i = 0; i < widths.length; i++) {

            css += '.tr > .td:nth-child(' + (i+1) + ') { width: '+  widths[i]+ 'px;  } ';
        }

        this._styleElement = can.$('<style></style>').html(css);
        this.$container.before( this._styleElement );

        this._movingContainer = toMove.wrapAll('<div class="movingContainer" />').parent();

        var $upperField = this._fillMetaInfo(this._movingContainer.prev());
        this._placeholderAtBottomOfGroup = !this._isMovingGroup && $upperField.isSubItem;
        if (this._placeholderAtBottomOfGroup) {
            this._toggleGroupSelection($upperField);
        }

        this._placeHolder = can.$('<div class="placeholder" style="width: '+width+'px; height: '+this._movingContainerHeight+'px" />');
        this._movingContainer.before(this._placeHolder);

        this._movingContainer
            .width(width)
            .height(this._movingContainerHeight)
            .css({ display: 'block', position: 'absolute' });
    },

    _findWhatToMove: function () {

        this._movingContainerHeight = this.$element.height();

        if (this.$element.hasClass('group')) {

            this._isMovingGroup = true;

            var move = [ this.$element[0] ];
            var $next = this.$element.next();

            while ($next && $next.hasClass('subitem')) {
                move.push($next[0]);
                this._movingContainerHeight += $next.height();
                $next = $next.next()
            }

            return can.$(move);
        } else {
            return this.$element;
        }
    },

    _rebuildTable: function () {

        this._styleElement.remove();
        this._placeHolder.remove();
        this._movingContainer.children().unwrap();
    }

};

/*
 * COMPONENTS
 */

$(document).ready(function () {

    var table = can.Component({

        tag: 'dg-table',

        template: can.view('#table-template'),

        viewModel: {

            _movedEntity: null,

            init: function () {
                this.attr('categories', getData());
            },

            dragEnded: function (item, $elem, event, data) {
                if (this._movedEntity !== null) {
                    this._removeItemFromOldPlace(this._movedEntity);
                    var movedFromGroup = this._movedEntity.group;

                    if (data.mergeWith) {
                        this._mergeItems(item, this._movedEntity);
                    } else {
                        var category;
                        var group = null;
                        var afterItem = null;

                        if (item instanceof Category) {
                            category = item;
                        } else if (item instanceof Group) {
                            category = item.category;
                            group = data.isInGroup ? item : null;
                            afterItem = data.isInGroup ? null : item;
                        } else {
                            category = item.category;
                            group = data.isInGroup ? item.group : null;
                            afterItem = !data.isInGroup && item.group ? item.group : item;
                        }

                        this._moveItem(this._movedEntity, category, group, afterItem);
                    }

                    if (movedFromGroup && movedFromGroup.subitems.length < 2) {
                        this._dismountGroup(movedFromGroup);
                    }

                    this._movedEntity = null;
                }
            },

            _removeItemFromOldPlace: function (movedItem) {
                var fromList;

                if (movedItem.group) {
                    fromList = movedItem.group.subitems;
                } else {
                    fromList = movedItem.category.items;
                }

                var whereToRemove = fromList.indexOf(movedItem);
                fromList.splice(whereToRemove, 1);
            },

            _dismountGroup: function (group) {
                var putItemsThere = group.category.items;
                var position = putItemsThere.indexOf(group);
                var spliceArgs = [position, 1];

                group.subitems.forEach(function (item) {
                    item.attr('group', null);
                    spliceArgs.push(item);
                });

                console.log("ssa", spliceArgs);
                putItemsThere.splice.apply(putItemsThere, spliceArgs);
            },

            _mergeItems: function (staticItem, movedItem) {

                var group = new Group({ name: 'test', category: staticItem.category, subitems: []});

                staticItem.attr('group', group);
                movedItem.attr('group', group);
                movedItem.attr('category', staticItem.category);

                group.subitems.push(staticItem);
                group.subitems.push(movedItem);

                var whereToPut = staticItem.category.items.indexOf(staticItem);
                staticItem.category.items.splice(whereToPut, 1, group);
            },

            _moveItem: function (item, toCategory, inGroup, afterItem) {

                var toList;

                if (inGroup) {
                    toList = inGroup.subitems;
                } else {
                    toList = toCategory.items;
                }

                var whereToPut = afterItem ? (toList.indexOf(afterItem) + 1) : 0;
                toList.splice(whereToPut, 0, item);

                item.attr('category', toCategory);
                item.attr('group', inGroup || null);
            },

            dragStarted: function (item) {
                this._movedEntity = item;
            },

        },

        events: {

            '.tr mousedown': function ($element, event) {

                var mover = new Mover($element, $element.parent('.table'));
                mover.run(event);
            }
        }

    });


    $('#content').html(can.view('#main-template', {}));
});
