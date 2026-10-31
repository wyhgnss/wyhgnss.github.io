function export_gnss_history(sourceFile, outputDirectory)
%EXPORT_GNSS_HISTORY Convert GNSSLPW.mat to compact browser-ready files.
%
%   export_gnss_history("H:\LPW模型\GNSSLPW.mat", "..\data\gnss")

arguments
    sourceFile (1, 1) string
    outputDirectory (1, 1) string
end

requiredVariables = [
    "LPWH_PRED_Test", "LPWL_PRED_Test", "LPWM_PRED_Test", ...
    "TIME2", "GNSS_STATION_NUM", "Latitude", "Longitude", ...
    "sattion_num", "Station_NAME"
];
source = load(sourceFile, requiredVariables{:});

observationCount = numel(source.TIME2);
if any([numel(source.LPWH_PRED_Test), numel(source.LPWL_PRED_Test), ...
        numel(source.LPWM_PRED_Test), numel(source.GNSS_STATION_NUM)] ~= observationCount)
    error("GNSS LPW observation vectors must have identical lengths.");
end

stationCount = numel(source.sattion_num);
if any([numel(source.Latitude), numel(source.Longitude), ...
        numel(source.Station_NAME)] ~= stationCount)
    error("GNSS station metadata vectors must have identical lengths.");
end

[times, ~, timeIndex] = unique(source.TIME2(:), "sorted");
[mapped, stationIndex] = ismember(source.GNSS_STATION_NUM(:), source.sattion_num(:));
if ~all(mapped)
    error("Every observed GNSS station number must exist in sattion_num.");
end

rows = [
    double(timeIndex), double(stationIndex), ...
    double(source.LPWL_PRED_Test(:)), ...
    double(source.LPWM_PRED_Test(:)), ...
    double(source.LPWH_PRED_Test(:))
];
if any(~isfinite(rows(:, 3:5)), "all")
    error("LPW values must be finite; missing stations should be absent rows.");
end

rows = sortrows(rows, [1, 2]);
duplicate = [false; all(diff(rows(:, 1:2), 1, 1) == 0, 2)];
if any(duplicate)
    duplicateRows = find(duplicate);
    if any(abs(rows(duplicateRows, 3:5) - rows(duplicateRows - 1, 3:5)) > 1e-6, "all")
        error("Duplicate time-station rows contain different LPW values.");
    end
    rows(duplicate, :) = [];
end

scale = 0.01;
quantized = round(rows(:, 3:5) ./ scale);
if any(quantized < intmin("int16") | quantized > intmax("int16"), "all")
    error("GNSS LPW values exceed the int16 range at the selected scale.");
end

timeIndexZero = uint16(rows(:, 1) - 1);
stationIndexZero = uint8(rows(:, 2) - 1);
low = int16(quantized(:, 1));
middle = int16(quantized(:, 2));
high = int16(quantized(:, 3));
recordCount = size(rows, 1);

counts = accumarray(rows(:, 1), 1, [numel(times), 1]);
offsets = uint32([0; cumsum(counts)]);
paddingAfterStation = mod(recordCount, 2);

outputDirectory = string(outputDirectory);
if ~isfolder(outputDirectory)
    mkdir(outputDirectory);
end
rawPath = fullfile(outputDirectory, "observations.bin");
compressedPath = rawPath + ".gz";
if isfile(rawPath), delete(rawPath); end
if isfile(compressedPath), delete(compressedPath); end

fileId = fopen(rawPath, "Wb", "ieee-le");
if fileId < 0
    error("Unable to create %s", rawPath);
end
cleanup = onCleanup(@() fclose(fileId));
fwrite(fileId, timeIndexZero, "uint16");
fwrite(fileId, stationIndexZero, "uint8");
if paddingAfterStation
    fwrite(fileId, 0, "uint8");
end
fwrite(fileId, low, "int16");
fwrite(fileId, middle, "int16");
fwrite(fileId, high, "int16");
clear cleanup;

gzip(rawPath, outputDirectory);
delete(rawPath);

times.Format = "yyyy-MM-dd'T'HH:mm:ss";
stations = repmat(struct("number", 0, "name", "", "latitude", 0, "longitude", 0), stationCount, 1);
for station = 1:stationCount
    stations(station).number = source.sattion_num(station);
    stations(station).name = char(source.Station_NAME(station));
    stations(station).latitude = source.Latitude(station);
    stations(station).longitude = source.Longitude(station);
end

manifest = struct;
manifest.product = "Historical GNSS Layered Precipitable Water";
manifest.source_file = "GNSSLPW.mat";
manifest.time_zone = "unspecified";
manifest.scale = scale;
manifest.record_count = recordCount;
manifest.times = cellstr(string(times));
manifest.offsets = double(offsets(:))';
manifest.stations = stations;
manifest.binary = struct( ...
    "url", "observations.bin.gz", ...
    "byte_order", "little-endian", ...
    "padding_after_station", paddingAfterStation, ...
    "layout", ["uint16 time_index", "uint8 station_index", ...
               "int16 low", "int16 middle", "int16 high"] ...
);

manifestPath = fullfile(outputDirectory, "manifest.json");
fileId = fopen(manifestPath, "W", "n", "UTF-8");
if fileId < 0
    error("Unable to create %s", manifestPath);
end
cleanup = onCleanup(@() fclose(fileId));
fprintf(fileId, "%s\n", jsonencode(manifest, PrettyPrint=true));
clear cleanup;

fprintf("Exported %d unique GNSS observations, %d times and %d stations to %s\n", ...
    recordCount, numel(times), stationCount, outputDirectory);
end
