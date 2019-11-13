<?php

$awsCommand = "/usr/bin/aws";

function sendMail($message) {
    global $awsCommand;

    $jsonMessage = [
        "Subject" => [
            "Data" => "Test email sent using the AWS CLI",
            "Charset" => "UTF-8"
        ],
        "Body" => [
            "Text" => [
                "Data" => "This is the message body in text format.",
                "Charset" => "UTF-8"
            ],
            "Html" => [
                "Data" => $message,
                "Charset" => "UTF-8"
            ]
        ]
    ];
    file_put_contents("message.json", json_encode($jsonMessage));

    $cmd = "{$awsCommand} ses send-email --from info@addnoise.nl --destination file://destination.json --message file://message.json";
    exec($cmd);
}

function updateItem($itemKey, $data) {
    global $awsCommand;

    $updates = [];
    $attrNames = [];
    $attrValues = [];
    foreach ($data as $key => $value) {
        $typeKey = "S";
        if (is_int($value)) $typeKey = "N";
        $updates[] = "#{$key} = :{$key}";
        $attrNames["#{$key}"] = $key;
        $attrValues[":{$key}"] = [ $typeKey => "{$value}" ];
    }
    $updateExpression = "SET " . implode(", ", $updates);
    $expressionAttributeNames = json_encode($attrNames);
    $expressionAttributeValues = json_encode($attrValues);

    $key = [];
    foreach ($itemKey as $k => $v) {
        $typeKey = "S";
        if (is_int($v)) $typeKey = "N";
        $key[$k] = [ $typeKey => "{$v}" ];
    }
    $key = json_encode($key);

    $cmd = "{$awsCommand} dynamodb update-item " .
        "--table-name \"EFS\" " .
        "--key '{$key}' " .
        "--update-expression \"{$updateExpression}\" " .
        "--expression-attribute-names '{$expressionAttributeNames}' " .
        "--expression-attribute-values '{$expressionAttributeValues}'";

    exec($cmd, $output, $return_val);
    // echo $cmd . PHP_EOL;
}

function getUsage() {
    $directories = [];
    exec("du -s -x /home/ec2-user/efs/*", $output, $return_val);
    foreach ($output as $line) {
        $line = trim($line);
        if (preg_match("/^(\d+)\s+(.*)$/", $line, $match)) {
            $usage = (int)$match[1];
            $dir = basename($match[2]);
            $directories[$dir] = $usage;
        }
    }

    return $directories;
}

ob_start();

try {

    $usage = getUsage();

    file_put_contents("usage.json", json_encode($usage));
    // $usage = json_decode(file_get_contents("usage.json"), true);

    foreach ($usage as $dir => $bytes) {
        updateItem([ "fsid" => "fs-5efd7097", "directory" => $dir ], [ "usage" => $bytes ]);
    }

} catch (Exception $ex) {
    echo $ex->getMessage() . PHP_EOL;
    echo $ex->getTraceAsString() . PHP_EOL;
}

// var_dump($servers);
$output = ob_get_clean();
sendMail($output);
