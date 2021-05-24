function humanFileSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
}

function cond(c, t, f) { if (c) { return t; } else { return f; } }

$(document).ready(function () {
    function update() {
        $.get('/status/').done(function (result) {
            localStorage.status = JSON.stringify(result);
            $('body').trigger('update');
            setTimeout(update, 2500);
        });
    }
    setTimeout(update, 2500);

    function proc_update() {
        $.get('/status/processes').done(function (result) {
            localStorage.processes = JSON.stringify(result);
            $('#process-panel').trigger('update');
            setTimeout(proc_update, 5000);
        });
    }
    setTimeout(proc_update, 5000);

    $('body').on('update', function (event) {
        var status = JSON.parse(localStorage.status);
        $('#cpu .resource-bar span').css('height', status.cpu.usage + '%');
        $('#cpu .resource-stats span').text(Math.round(status.cpu.usage) + '%');
        $('#ram .resource-bar span').css('height', status.ram + '%');
        $('#ram .resource-stats span').text(Math.round(status.ram) + '%');

        var dummy_disks = $("<div id='disk-area' class='noscroll'></div>");
        for (var disk of Object.keys(status.disk)) {
            dummy_disks.append(
                $('<div class="disk-item shadow-sm"></div>')
                    .append(
                        $('<span class="disk-name"></span>').text(disk.toUpperCase())
                    )
                    .append(
                        $('<div class="filled-bar"></div>')
                            .append(
                                $('<span></span>')
                                    .css('width', status.disk[disk][3] + '%')
                            )
                    )
                    .append(
                        $('<span class="disk-stat"></span>')
                            .text(humanFileSize(status.disk[disk][1], true) + ' / ' + humanFileSize(status.disk[disk][0], true))
                    )
            )
        }
        dummy_disks.replaceAll('#disk-area');
    });

    $('#process-panel').on('update', function (event) {
        var dummy_procs = $("<div id='process-area' class='noscroll'></div>");
        var processes = JSON.parse(localStorage.processes);
        for (var proc of Object.keys(processes)) {
            var process = processes[proc];
            var proc_item = $('<div class="process-item"></div>');
            proc_item.append(
                $('<span class="process-title"></span>')
                    .text(process.pid + ': ' + process.name + ' @ ' + process.cwd)
            );
            proc_item.append($('<span class="process-ram"></span>').text('RAM: ' + process.ram_percent.toFixed(2).toString() + '%'));
            var ctime = new Date();
            ctime.setTime(process.create_time);
            proc_item.append(
                $('<span class="process-ctime"></span>')
                    .text(ctime.getHours() + ':' + ctime.getMinutes() + ':' + ctime.getSeconds())
            );
            if (process.connections.length > 0) {
                proc_item.append(
                    $('<div class="process-connections"></div>')
                        .append(process.connections.map(function (v, i, a) {
                            return $('<div class="process-connection-item"></div>')
                                .append(
                                    $('<span class="conn-title"></span>')
                                        .text(
                                            v.family + '/' + v.type.toUpperCase() + cond(
                                                v.local.length == 2, ' @ ', ''
                                            ) + cond(
                                                v.local.length == 2, v.local[0] + ':' + v.local[1], ''
                                            ) + cond(
                                                v.remote.length == 2, ' -> ' + v.remote[0] + ':' + v.remote[1], ''
                                            )
                                        )
                                )
                                .append(
                                    $('<span class="conn-status"></span>').text(v.status)
                                );
                        }))
                );
            }
            dummy_procs.append(proc_item);
        }
        var cscroll = $('#process-area').scrollTop();
        dummy_procs.replaceAll('#process-area');
        $('#process-area').scrollTop(cscroll);
    });

    $('body').trigger('update');
    $('#process-panel').trigger('update');
});