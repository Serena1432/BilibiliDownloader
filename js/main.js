function i(e) {
	return document.getElementById(e);
}

$('#urlForm').submit(function(e){
    e.preventDefault();
	i("error").innerText = "";
	i("success").innerText = "";
	i("status").innerText = "";
	var downloadFile = "";
	var url = i("url").value, im = url.substr(url.indexOf("/mc") + 3), ij = im.substr(im.indexOf("/") + 1), id;
	if (!url) return i("error").innerText = "Please type an URL!";
	i("submit").disabled = true;
	if (im.includes("?")) id = parseInt(ij.substr(0, ij.indexOf("?"))); 
	else id = parseInt(im);
    $.ajax({
        url: '/Download/' + id,
        type: 'get',
        success: function(data) {
			i("success").innerText = "The compressed file containing images from the comic URL is being downloaded.";
			i("status").innerText = "";
			i("submit").disabled = false;
			downloadFile = data.path;
			document.location.href = data.path;
        },
		error: function(data) {
			i("error").innerText = JSON.parse(data.responseText).message;
			downloadFile = ".";
			i("submit").disabled = false;
		}
    });
	var interval = setInterval(function() {
		if (!downloadFile) {
			$.ajax({
				url: '/Status/' + id,
				type: 'get',
				success: function(data){
					i("status").innerText = data.status;
				}
			});
		}
		else clearInterval(interval);
	}, 1000);
});