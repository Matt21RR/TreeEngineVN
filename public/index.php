<?php
function getHierarchy($dir,&$res)
{
  // open handler for the directory
  $iter = new DirectoryIterator($dir);

  foreach ($iter as $indMimic => $item) {
    if ($item != '.' && $item != '..') {
      if ($item->isDir()) {
        $newdir = $dir . "/" . $item;
        $res1 = [];
        getHierarchy($newdir,$res1);
        array_unshift($res,array(
          "name"=>$item->getBasename(),
          "type"=>"dir",
          "route"=>$newdir,
          "content"=>$res1,
        ));
      }else{
        $mime = $item->getSize() == 0 ? "text/plain" : mime_content_type($dir . "/" . $item->getFilename());
        array_push($res,array(
          "name"=>$item->getFilename(),
          "type"=>"file",
          "mime"=>$mime,
          "size"=>$item->getSize(),
          "route"=>$dir . "/" . $item->getFilename(),
        ));
      }
    }
  }
  for ($i=0; $i < sizeof($res); $i++) { 
    $res[$i]["index"] = $i;
  }
}

function createFile($dir,$filename){
  $res = file_put_contents($dir."/".$filename,"");
  return is_numeric($res);
}
function indexate($dir){
  $res = [];
  indexateStuff($dir,$res);
}

function indexateStuff($dir,&$res){
    // open handler for the directory
    $iter = new DirectoryIterator($dir);

    foreach ($iter as $indMimic => $item) {
      if ($item != '.' && $item != '..') {
        if ($item->isDir()) {
          $newdir = $dir . "/" . $item;
          $res1 = [];
          array_unshift($res,array(
            "name"=>$item->getBasename(),
            "type"=>"dir",
            "route"=>$newdir,
            "content"=>$res1,
          ));
          indexateStuff($newdir,$res1);
        }else{
          $mime = $item->getSize() == 0 ? "text/plain" : mime_content_type($dir . "/" . $item->getFilename());
          array_push($res,array(
            "name"=>$item->getFilename(),
            "type"=>"file",
            "mime"=>$mime,
            "size"=>$item->getSize(),
            "route"=>$dir . "/" . $item->getFilename(),
          ));
        }
      }
    }
}

if(!is_dir("./game")){
  mkdir("./game");
}
if (key_exists("action", $_POST)) {
  $action = $_POST["action"];
  switch ($action) {
    case 'getHierarchy':
      $a = [];
      getHierarchy("./game",$a);
      $res = [
        "name"=>"game",
        "type"=>"dir",
        "route"=>"./game",
        "content"=>$a,
        "index"=>0
      ];

      echo json_encode($res);
      break;

    case 'createFile':
      $dir = $_POST['dir'];
      $filename = $_POST['filename'];
      echo json_encode(createFile($dir,$filename));

      break;
    case 'createDir':
      $dir = $_POST['dir'];
      $name = $_POST['folderName'];
      echo json_encode(mkdir($dir."/".$name));

      break;
    case 'delete':
      $res = false;
      $dir = $_POST['dir'];
      $type = $_POST['type'];
      if($type == "dir"){
        $res = rmdir($dir);
      }else if($type == "file"){//delete file
        $res = unlink($dir);
      }
      echo json_encode($res);

      break;
    case 'rename':
      $res = false;
      $oldRoute = $_POST['oldRoute'];
      $newRoute = $_POST['newRoute'];
      $type = $_POST['type'];

      rename($oldRoute,$newRoute);
      break;
    case 'upload':
      $target_dir = $_POST['dir'];
      $target_route = $target_dir ."/". basename($_FILES["file"]["name"]);
      // echo $target_route;
      $res = move_uploaded_file($_FILES["file"]["tmp_name"], $target_route);
      echo json_encode($res);
      break;
    case 'update':
      $target_route = $_POST['route'];
      $content = $_POST['content'];
      echo json_encode(file_put_contents($target_route,$content));
      break;
    case 'indexate':
      $target_dir = $_POST['dir'];
      indexate($target_dir);
  }
} else {
  echo json_encode($_GET);
}
