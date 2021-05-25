function cond(c, t, f) { if (c) { return t; } else { return f; } }

var status_colors = {
    running: '#18db12',
    restarting: '#ffa600',
    paused: '#e1ed00',
    exited: '#e30e0e'
};

function update_container_list(containers, force) {
    if (JSON.stringify(containers) != window.sessionStorage.getItem('last_containers') || force == true) {
        console.log(containers);
        window.sessionStorage.setItem('last_containers', JSON.stringify(containers));

        var dummy_area = $("<div id='docker-area' class='noscroll'></div>");
        for (var c of Object.keys(containers)) {
            var container = containers[c];
            var container_item = $('<div class="container-item shadow-sm"></div>');
            container_item.attr('data-container-id', container.id);
            container_item.attr('data-container-short-id', container.short_id);
            container_item.append(
                $('<span class="container-name"></span>').text(container.name+':'+container.short_id)
            );
            container_item.append(
                $('<span class="container-status noselect"></span>')
                    .text(container.status)
                    .css('background-color', cond(Object.keys(status_colors).includes(container.status), status_colors[container.status], status_colors.restarting))
            );

            container_item.append(
                $('<button class="container-button btn-rename noselect"></button>')
                    .append('<span class="material-icons">drive_file_rename_outline</span>')
                    .on('click', function (event) {
                        var newname = prompt('Enter new name for container.');
                        if (newname) {
                            $.post(
                                '/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')+'/rename', 
                                JSON.stringify({'name':newname})
                            ).done(console.log);
                        }
                    })
            );
            container_item.append(
                $('<button class="container-button btn-stop noselect"></button>')
                    .append('<span class="material-icons-round">stop</span>')
                    .on('click', function (event) {
                        if (window.confirm('Are you sure you want to stop this Docker instance?')) {
                            $.post('/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')+'/stop').done(console.log);
                        }
                    })
            );
            container_item.append(
                $('<button class="container-button btn-restart noselect"></button>')
                    .append('<span class="material-icons">autorenew</span>')
                    .on('click', function (event) {
                        $.post('/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')+'/restart').done(console.log);
                    })
            );
            if (container.status != 'paused') {
                container_item.append(
                    $('<button class="container-button btn-pause noselect"></button>')
                        .append('<span class="material-icons">pause</span>')
                        .on('click', function (event) {
                            $.post('/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')+'/pause').done(console.log);
                        })
                );
            } else {
                container_item.append(
                    $('<button class="container-button btn-pause noselect"></button>')
                        .append('<span class="material-icons">play_arrow</span>')
                        .on('click', function (event) {
                            $.post('/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')+'/unpause').done(console.log);
                        })
                );
            }
            container_item.append(
                $('<button class="container-button btn-see-attrs noselect"></button>')
                    .append('<span class="material-icons">text_snippet</span>')
                    .on('click', function (event) {
                        $.get('/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')).done(function (result, status, xhr) {
                            if (xhr.status == 200) {
                                $('#attr-viewer').remove();
                                $('<div id="attr-viewer" class="shadow"></div>')
                                    .append(
                                        $('<div id="json-area" class="noscroll"></div>')
                                            .html(JSON.stringify(result, null, 4))
                                    )
                                    .append(
                                        $('<button class="shadow-sm"></button>')
                                            .append('<span class="material-icons">close</span>')
                                            .on('click', function () {
                                                $('#attr-viewer').remove();
                                            })
                                    )
                                    .appendTo('body');
                            }
                        });
                    })
            );
            container_item.append(
                $('<button class="container-button btn-see-log noselect"></button>')
                    .append('<span class="material-icons">dvr</span>')
                    .on('click', function (event) {
                        $.get('/commander/containers/'+$(this).parents('.container-item').attr('data-container-id')+'/logs').done(function (result, status, xhr) {
                            if (xhr.status == 200) {
                                $('#attr-viewer').remove();
                                $('<div id="attr-viewer" class="shadow"></div>')
                                    .append(
                                        $('<div id="json-area" class="noscroll"></div>')
                                            .html(result.logs)
                                    )
                                    .append(
                                        $('<button class="shadow-sm"></button>')
                                            .append('<span class="material-icons">close</span>')
                                            .on('click', function () {
                                                $('#attr-viewer').remove();
                                            })
                                    )
                                    .appendTo('body');
                            }
                        });
                    })
            );

            dummy_area.append(container_item);
        }
        var cscroll = $('#docker-area').scrollTop();
        dummy_area.replaceAll('#docker-area');
        $('#docker-area').scrollTop(cscroll);
    }
}

$(document).ready(function () {
    $('#new-container-dialog').hide();
    window.setInterval(function () {
        $.get('/commander/containers').done(update_container_list);
    }, 1000);
    if (window.sessionStorage.getItem('last_containers')) {
        update_container_list(JSON.parse(window.sessionStorage.getItem('last_containers')), true);
        $.get('/commander/containers').done(update_container_list);
    } else {
        $.get('/commander/containers').done(update_container_list);
    }

    $('#enter-remote-container').on('change', function () {
        $.post('/commander/containers/new/remote', JSON.stringify({
            'name': $(this).val(),
            'envvars': $('#envvars-input').val().split(';'),
            'volumes': $('#vols-input').val().split(';'),
            'display_name': $('#name-input').val().toLowerCase().replace(/ /g, '-'),
            'vfrom': $('#vfrom-input').val().split(';')
        })).done((function (result) {
            console.log(result);
            var dat = JSON.parse(localStorage.getItem('remote_containers'));
            dat.push($(this).val());
            localStorage.setItem('remote_containers', JSON.stringify(dat));
            $('#new-container-dialog').hide();
        }).bind(this));
    });

    $('#add-container').on('click', function () {
        $('#enter-remote-container').val('');
        if (!localStorage.getItem('remote_containers')) {
            localStorage.setItem('remote_containers', '[]');
        }
        var dummy_remote_containers = $("<div class='list noscroll'></div>");
        for (var container of JSON.parse(localStorage.getItem('remote_containers'))) {
            dummy_remote_containers.append(
                $('<span class="container-item"></span>')
                    .text(container)
                    .on('click', function (event) {
                        $.post('/commander/containers/new/remote', JSON.stringify({
                            'name': $(this).text(),
                            'envvars': $('#envvars-input').val().split(';'),
                            'volumes': $('#vols-input').val().split(';'),
                            'display_name': $('#name-input').val().toLowerCase().replace(/ /g, '-'),
                            'vfrom': $('#vfrom-input').val().split(';')
                        })).done((function (result) {
                            console.log(result);
                            $('#new-container-dialog').hide();
                        }).bind(this));
                    })
            );
        }
        dummy_remote_containers.replaceAll('#remote-container-box .list');

        $.get('/commander/repositories').done(function (result) {
            var dummy_local_containers = $("<div class='list noscroll'></div>");
            for (var container of result) {
                dummy_local_containers.append(
                    $('<span class="container-item"></span>')
                        .text(container)
                        .on('click', function (event) {
                            $.post('/commander/containers/new/local', JSON.stringify({
                                'name': $(this).text(),
                                'envvars': $('#envvars-input').val().split(';'),
                                'volumes': $('#vols-input').val().split(';'),
                                'display_name': $('#name-input').val().toLowerCase().replace(/ /g, '-'),
                                'vfrom': $('#vfrom-input').val().split(';')
                            })).done(console.log);
                            $('#new-container-dialog').hide();
                        })
                );
            }
            dummy_local_containers.replaceAll('#local-container-box .list');
            $('#new-container-dialog').show();
        });
    });
});