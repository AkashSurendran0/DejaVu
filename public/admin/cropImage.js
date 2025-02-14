const imageInput=document.getElementById('imageInput')
const imagePreview=document.getElementById('imagePreview')
const cropContainer=document.getElementById('cropContainer')
const cropButton=document.getElementById('cropButton')
const uploadButton=document.getElementById('uploadButton')
const croppedResult=document.getElementById('croppedResult')
let cropper;
let selectedFiles=[]
let croppedImages=[]  

imageInput.addEventListener('change', (event)=>{
    selectedFiles=Array.from(event.target.files)
    if(selectedFiles.length>0){
        loadImageForCropping(0)
    }
})

function loadImageForCropping(index){
    if(index<selectedFiles.length){
        const file=selectedFiles[index]
        const reader=new FileReader()
        reader.onload=(e)=>{
            imagePreview.src=e.target.result
            cropContainer.style.display='block'
            cropButton.style.display='block'
            uploadButton.style.display='none'

            if(cropper){
                cropper.destroy()
            }
            cropper=new Cropper(imagePreview, {
                viewMode:1,
                autoCropArea:1,
                movable:true,
                zoomable:true,
                scalable:true,
                cropBoxResizable:true
            })

            cropButton.onclick=()=>{
                cropCurrentImage(index)
            }
        }
        reader.readAsDataURL(file)
    }else{
        uploadButton.style.display='block'
    }
}

function cropCurrentImage(index){
    if(cropper){
        const canvas=cropper.getCroppedCanvas()
        canvas.toBlob((blob)=>{
            croppedImages.push(blob)

            const img=document.createElement('img')
            img.src=URL.createObjectURL(blob)
            img.style.margin='10px'
            img.style.width='10px'
            img.style.height='10px'
            croppedResult.appendChild(img)

            loadImageForCropping(index+1)
        })
    }
}

uploadButton.addEventListener('click', ()=>{
    const formData=new FormData()
    croppedImages.forEach((blob,index)=>{
        formData.append(`image${index}`,blob,`cropped-Image-${index}.png`)
    })

    fetch('admin/products/cropImage', {
        method: 'post',
        body: formData
    })
    .then((response)=>response.json())
    .then((data)=>{
        alert('All images uploaded successfully')
    })
    .catch((error)=>{
        console.log('Upload Failed:', error);
    })
})