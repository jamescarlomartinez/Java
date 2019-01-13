
public class Car
{
    public void motor()
    {
        System.out.println("hyundai accent is the best");
    }
}
class Vehicle extends Car
{
    public void motor()
    {
        System.out.println("i like jeep");
    }
}

class Mobile
{
    public static void main(String[] args)
    {
        Car a = new Car();
        Car b = new Vehicle();
        b.motor();
        a.motor();
    }


}
